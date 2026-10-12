import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

/** HTTP integration checks against the actual local workerd and D1 binding. */
export async function runSmoke(runtime, database, origin) {
  const checks = [];
  const fetch = (path, options) => runtime.dispatchFetch(origin + path, options);
  const pass = label => { checks.push({ label, passed: true }); console.log(`[PASS] ${label}`); };
  for (const path of ['/', '/apis', '/styles.css', '/clean.css', '/app.js', '/launch', '/maker', '/advertise', '/feedback', '/maker/admin', '/maker/newsletter']) {
    const response = await fetch(path);
    assert.equal(response.status, 200, `${path} should return 200`);
    const text = await response.text();
    assert.ok(text.length > 100, `${path} must have content`);
    if (path === '/') {
      assert.match(text, /clean\.css/);
      assert.match(text, /Local preview/);
      await writeFile('.wrangler/local-preview/home.html', text);
    }
    pass(`GET ${path} returns populated 200`);
  }
  const listingResponse = await fetch('/api/v1/products');
  const products = await listingResponse.json();
  assert.ok(products.meta.total > 0);
  const listing = products.data[0];
  assert.ok(listing.slug);
  const detail = await fetch(`/products/${listing.slug}`);
  assert.equal(detail.status, 200);
  assert.match(await detail.text(), new RegExp(listing.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  pass('Product detail returns selected listing');
  const query = await fetch('/api/v1/products?q=' + encodeURIComponent(listing.name));
  const search = await query.json();
  assert.ok(search.data.some(row => row.slug === listing.slug));
  pass('Search finds selected product');
  const filter = await fetch('/api/v1/products?pricing=free');
  const filtered = await filter.json();
  assert.ok(filtered.data.length > 0);
  assert.ok(filtered.data.every(row => row.pricing === 'free'));
  pass('Free pricing filter returns only free listings');
  const partial = await fetch('/?pricing=free&partial=1');
  const fragment = await partial.text();
  assert.equal(partial.status, 200); assert.doesNotMatch(fragment, /<html/);
  assert.match(fragment, /data-results/);
  pass('Live filtering returns partial HTML region');
  const before = await database.prepare('SELECT (upvotes - downvotes) AS score FROM apis WHERE slug=?').bind(listing.slug).first();
  const options = { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: 'value=1' };
  const vote = await fetch(`/products/${listing.slug}/vote`, options);
  assert.equal(vote.status, 200);
  const voted = await vote.json();
  assert.equal(voted.myVote, 1); assert.equal(voted.score, before.score + 1);
  const cookie = vote.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const unvote = await fetch(`/products/${listing.slug}/vote`, { ...options, headers: { ...options.headers, cookie } });
  const removed = await unvote.json();
  assert.equal(removed.myVote, 0); assert.equal(removed.score, before.score);
  pass('Vote toggles on/off for same cookie and restores score');
  const invalidVote = await fetch(`/products/${listing.slug}/vote`, { ...options, body: 'value=5' });
  assert.equal(invalidVote.status, 400);
  pass('Invalid vote rejected');
  const noCsrf = await fetch('/maker/launch', { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Test' });
  assert.equal(noCsrf.status, 403);
  pass('Maker mutation without CSRF rejected');
  await writeFile('.wrangler/local-preview/http-smoke.json', JSON.stringify({ at: new Date().toISOString(), runtime: 'Miniflare/workerd + local D1', checks, browserTested: false }, null, 2) + '\n');
  console.log(`[preview] ${checks.length} real-runtime checks passed. Browser interactions are a separate verification stage.`);
}
