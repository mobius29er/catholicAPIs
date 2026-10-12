import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makerApp } from '../src/maker';
import { listActiveAds, localMakerEnabled, safeExternalUrl, validAdMonth, validLaunchDate } from '../src/maker-db';
import type { Env } from '../src/types';

// Real SQLite constraints/transactions behind a minimal D1 adapter. No network.
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync('migrations/0008_local_maker.sql', 'utf8'));
  function prepared(sql: string, args: SQLInputValue[] = []) {
    return {
      bind(...values: SQLInputValue[]) { return prepared(sql, values); },
      async first<T>(column?: string): Promise<T | null> {
        const row = sqlite.prepare(sql).get(...args);
        return (row ? column ? row[column] : row : null) as T | null;
      },
      async all<T>() { return { results: sqlite.prepare(sql).all(...args) as T[], success: true, meta: {} }; },
      async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; },
    };
  }
  const DB = {
    prepare: prepared,
    async batch(statements: ReturnType<typeof prepared>[]) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  return { sqlite, DB };
}
let db: ReturnType<typeof database>;
let env: Env;
beforeEach(() => { db = database(); env = { DB: db.DB, LOCAL_PREVIEW: '1', LOCAL_ADMIN_TOKEN: 'local-preview-admin', ASSETS: {} as Fetcher }; });
afterEach(() => db.sqlite.close());
const today = () => new Date().toISOString().slice(0,10);
const month = () => new Date().toISOString().slice(0,7);
const count = (table: string) => Number(db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);
const row = (table: string) => db.sqlite.prepare(`SELECT * FROM ${table} LIMIT 1`).get()!;
class Browser {
  jar = new Map<string,string>();
  origin = 'http://localhost:8787';
  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('cookie', [...this.jar].map(([k,v]) => `${k}=${v}`).join('; '));
    const response = await makerApp.request(`${this.origin}${path}`, { ...init, headers }, env);
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const position = pair.indexOf('=');
      if (cookie.includes('Max-Age=0')) this.jar.delete(pair.slice(0,position));
      else this.jar.set(pair.slice(0,position),pair.slice(position+1));
    }
    return response;
  }
  get(path: string) { return this.request(path); }
  post(path: string, values: Record<string,string> = {}, headers: Record<string,string> = {}) {
    return this.request(path, { method: 'POST', headers: { origin: this.origin, 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams({ csrf:this.jar.get('fh_local_csrf')??'',action_key:crypto.randomUUID(),...values }).toString() });
  }
  async admin() { await this.get('/maker/admin'); const response=await this.post('/maker/admin/login',{admin_key:'local-preview-admin'}); expect(response.status).toBe(303); return this; }
  async draft(actionKey = crypto.randomUUID()) {
    await this.get('/launch');
    const response=await this.post('/maker/launch',{action_key:actionKey,name:'Test Prayer',tagline:'A focused daily prayer app',homepage_url:'https://example.com/product',description:'Daily prayer for parishioners and families.',display_name:'Test maker'});
    expect(response.status).toBe(303);
    return response.headers.get('location')!.split('?')[0];
  }
  async requestAccess(name='Beta maker') { await this.get('/feedback'); expect((await this.post('/maker/feedback/access',{display_name:name})).status).toBe(303); return db.sqlite.prepare('SELECT id FROM maker_accounts WHERE display_name=? ORDER BY created_at DESC').get(name)!.id as string; }
}
async function admit(admin: Browser, member: Browser, name: string) {
  const id=await member.requestAccess(name);
  expect((await admin.post('/maker/admin/access',{account_id:id,state:'invited'})).status).toBe(303);
  expect((await member.post('/maker/feedback/accept')).status).toBe(303);
  return id;
}
const feedbackValues={name:'Parish tool',target_url:'https://example.com/app',audience:'Parish volunteers',question:'Can you find the next volunteer shift?'};
const reviewValues={context:'I searched for a volunteer shift.',worked:'The calendar was easy to scan.',friction:'The confirmation button was hard to find.',suggestion:'Make the confirmation button more visible.'};

describe('local maker boundary and validation',()=>{
  it('is disabled unless explicitly enabled on loopback',async()=>{
    expect(localMakerEnabled('1','http://localhost:8787')).toBe(true);
    expect(localMakerEnabled('true','http://127.0.0.1:8787')).toBe(true);
    expect(localMakerEnabled(undefined,'http://localhost:8787')).toBe(false);
    expect(localMakerEnabled('1','https://fideshunt.com')).toBe(false);
    expect((await makerApp.request('https://fideshunt.com/launch',{},env)).status).toBe(404);
    env.LOCAL_PREVIEW='0';expect((await new Browser().get('/launch')).status).toBe(404);
  });
  it('rejects unsafe URLs and impossible dates',()=>{
    for(const url of ['javascript:alert(1)','data:text/html,hi','https://u:p@example.com','http://127.0.0.1','http://2130706433','http://10.1.2.3','http://localhost','https://test.local','http://[::1]'])expect(safeExternalUrl(url),url).toBeNull();
    expect(safeExternalUrl('https://example.com/product')).toBe('https://example.com/product');
    expect(validLaunchDate('2026-02-30',new Date('2026-02-01'))).toBe(false);
    expect(validLaunchDate('2026-01-31',new Date('2026-02-01'))).toBe(false);
    expect(validLaunchDate('2026-02-02',new Date('2026-02-01'))).toBe(true);
    expect(validLaunchDate('2028-02-02',new Date('2026-02-01'))).toBe(false);
    expect(validAdMonth('2026-13')).toBe(false);
  });
  it('requires both same origin and CSRF token for every mutation',async()=>{
    const b=new Browser();await b.get('/maker/newsletter');
    const values={email:'maker@example.com',consent:'1'};
    expect((await b.post('/maker/newsletter',{...values,csrf:'wrong'})).status).toBe(403);
    expect((await b.post('/maker/newsletter',values,{origin:'https://attacker.example'})).status).toBe(403);
    expect((await b.post('/maker/newsletter',values,{origin:''})).status).toBe(403);
    expect(count('maker_newsletter')).toBe(0);
    expect((await b.post('/maker/newsletter',values)).status).toBe(303);
    expect(count('maker_newsletter')).toBe(1);
  });
  it('rejects forged and expired session cookies; admin requires a separate key',async()=>{
    const b=new Browser();await b.get('/maker/admin');
    expect((await b.post('/maker/admin/login',{admin_key:'wrong'})).status).toBe(403);
    expect(count('maker_sessions')).toBe(0);
    b.jar.set('fh_local_session',crypto.randomUUID()+crypto.randomUUID());
    expect((await b.post('/maker/admin/inventory',{month:month(),placement:'sidebar',capacity:'5'})).status).toBe(401);
    const path=await b.draft();
    expect((await b.post('/maker/admin/inventory',{month:month(),placement:'sidebar',capacity:'5',is_admin:'1'})).status).toBe(403);
    db.sqlite.exec('UPDATE maker_sessions SET expires_at=0');
    expect((await b.get(path)).status).toBe(401);
  });
});

describe('launch flow',()=>{
  it('shows the draft without login and creates one idempotent draft',async()=>{
    const b=new Browser();const response=await b.get('/launch');expect(response.status).toBe(200);expect(await response.text()).toContain('name="homepage_url"');expect(count('maker_accounts')).toBe(0);
    const actionKey=crypto.randomUUID();const firstPath=await b.draft(actionKey);const secondPath=await b.draft(actionKey);
    expect(firstPath).toBe(secondPath);expect(count('maker_accounts')).toBe(1);expect(count('maker_launches')).toBe(1);
  });
  it('enforces checkout before schedule and keeps repeated checkout/scheduling safe',async()=>{
    const b=new Browser();const path=await b.draft();
    expect((await b.post(`${path}/schedule`,{launch_date:today()})).status).toBe(409);
    expect((await b.post(`${path}/checkout`,{simulation:'0'})).status).toBe(400);
    for(let n=0;n<2;n++)expect((await b.post(`${path}/checkout`,{simulation:'1'})).status).toBe(303);
    expect(count('maker_checkouts')).toBe(1);expect(row('maker_checkouts').amount_cents).toBe(2900);expect(row('maker_checkouts').mode).toBe('simulation');
    for(let n=0;n<2;n++)expect((await b.post(`${path}/schedule`,{launch_date:today()})).status).toBe(303);
    expect(row('maker_launches').state).toBe('scheduled');
    expect((await b.post(`${path}/checkout`,{simulation:'1'})).status).toBe(303);expect(row('maker_launches').state).toBe('scheduled');
    for(let n=0;n<2;n++)expect((await b.post(`${path}/service`,{kind:'video'})).status).toBe(303);
    expect(count('maker_services')).toBe(1);
  });
  it('keeps launch content and writes scoped to the owning session',async()=>{
    const a=new Browser(),b=new Browser();const path=await a.draft();await b.draft();
    expect((await b.get(path)).status).toBe(404);expect((await b.post(`${path}/checkout`,{simulation:'1'})).status).toBe(404);expect(count('maker_checkouts')).toBe(0);
  });
  it('ends the server session on logout',async()=>{const b=new Browser();const path=await b.draft();expect((await b.post('/maker/logout')).status).toBe(303);expect(count('maker_sessions')).toBe(0);expect((await b.get(path)).status).toBe(401);});
});

describe('advertising and newsletter',()=>{
  it('allocates monthly capacity atomically and records idempotent labeled clicks',async()=>{
    const admin=await new Browser().admin(),maker=new Browser();await maker.get('/advertise');
    for(const name of ['Sponsor one','Sponsor two'])expect((await maker.post('/maker/advertise',{name,tagline:'A prayer app for busy families',target_url:'https://example.com',month:month(),placement:'sidebar'})).status).toBe(303);
    const ads=db.sqlite.prepare('SELECT id FROM maker_ad_requests ORDER BY name').all();const id=String(ads[0].id),other=String(ads[1].id);
    expect((await maker.post(`/maker/admin/ads/${id}`,{state:'approved'})).status).toBe(403);
    expect((await admin.post(`/maker/admin/ads/${id}`,{state:'approved'})).status).toBe(303);
    expect((await admin.post(`/maker/admin/ads/${id}`,{state:'approved'})).status).toBe(303);
    expect((await admin.post(`/maker/admin/ads/${other}`,{state:'approved'})).status).toBe(409);
    expect((await admin.post('/maker/admin/inventory',{month:month(),placement:'sidebar',capacity:'0'})).status).toBe(409);
    expect((await listActiveAds(env)).length).toBe(1);
    const actionKey=crypto.randomUUID();
    for(let n=0;n<2;n++){const r=await maker.post(`/maker/ad-click/${id}`,{action_key:actionKey});expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('https://example.com/');}
    expect(count('maker_ad_clicks')).toBe(1);
    expect(await (await maker.get('/advertise')).text()).toContain('Sponsored · Local preview');
    expect((await admin.post(`/maker/admin/ads/${id}`,{state:'declined'})).status).toBe(303);
    expect((await maker.post(`/maker/ad-click/${id}`)).status).toBe(404);
    expect((await admin.post(`/maker/admin/ads/${other}`,{state:'approved'})).status).toBe(303);
  });
  it('queues one newsletter opt-in per email only with explicit consent',async()=>{
    const b=new Browser();await b.get('/maker/newsletter');
    expect((await b.post('/maker/newsletter',{email:'hello@example.com'})).status).toBe(400);
    for(const email of ['hello@example.com','HELLO@EXAMPLE.COM'])expect((await b.post('/maker/newsletter',{email,consent:'1'})).status).toBe(303);
    expect(count('maker_newsletter')).toBe(1);expect(row('maker_newsletter').state).toBe('queued_mock');
    expect(await (await b.get('/maker/admin?tab=newsletter')).text()).not.toContain('hello@example.com');
  });
});

describe('free invite-only feedback beta',()=>{
  it('requires admin invite and acceptance; revocation blocks all content and actions',async()=>{
    const admin=await new Browser().admin(),member=new Browser();const id=await member.requestAccess('Applicant');
    expect((await member.post('/maker/feedback/requests',feedbackValues)).status).toBe(403);
    expect((await member.post('/maker/feedback/accept')).status).toBe(403);
    expect((await admin.post('/maker/admin/access',{account_id:id,state:'invited'})).status).toBe(303);
    expect((await member.post('/maker/feedback/requests',feedbackValues)).status).toBe(403);
    expect((await member.post('/maker/feedback/accept')).status).toBe(303);
    const created=await member.post('/maker/feedback/requests',feedbackValues);expect(created.status).toBe(303);const path=created.headers.get('location')!;
    expect((await member.get(path)).status).toBe(200);
    expect((await admin.post('/maker/admin/access',{account_id:id,state:'revoked'})).status).toBe(303);
    expect((await member.get(path)).status).toBe(403);expect((await member.post('/maker/feedback/requests',feedbackValues)).status).toBe(403);expect((await member.post('/maker/feedback/access')).status).toBe(403);
  });
  it('does not accept expired invitations',async()=>{
    const admin=await new Browser().admin(),member=new Browser();const id=await member.requestAccess('Expired');
    await admin.post('/maker/admin/access',{account_id:id,state:'invited'});db.sqlite.exec("UPDATE maker_feedback_access SET invite_expires_at=0");
    expect((await member.post('/maker/feedback/accept')).status).toBe(403);expect((await member.post('/maker/feedback/access')).status).toBe(303);expect(row('maker_feedback_access').state).toBe('requested');
  });
  it('supports structured review, owner useful marking, closure, and replay safety',async()=>{
    const admin=await new Browser().admin(),owner=new Browser(),reviewer=new Browser(),late=new Browser();await admit(admin,owner,'Owner');await admit(admin,reviewer,'Reviewer');await admit(admin,late,'Late');
    const actionKey=crypto.randomUUID();const created=await owner.post('/maker/feedback/requests',{...feedbackValues,action_key:actionKey});const path=created.headers.get('location')!;const id=path.split('/').pop()!;
    expect((await owner.post('/maker/feedback/requests',{...feedbackValues,action_key:actionKey})).headers.get('location')).toBe(path);expect(count('maker_feedback_requests')).toBe(1);
    expect((await owner.post(`/maker/feedback/${id}/reviews`,reviewValues)).status).toBe(403);
    expect((await reviewer.post(`/maker/feedback/${id}/reviews`,{...reviewValues,suggestion:''})).status).toBe(400);
    for(let n=0;n<2;n++)expect((await reviewer.post(`/maker/feedback/${id}/reviews`,reviewValues)).status).toBe(303);expect(count('maker_feedback_reviews')).toBe(1);
    const reviewId=String(row('maker_feedback_reviews').id);
    expect((await reviewer.post(`/maker/feedback/reviews/${reviewId}/useful`)).status).toBe(403);
    for(let n=0;n<2;n++)expect((await owner.post(`/maker/feedback/reviews/${reviewId}/useful`)).status).toBe(303);expect(row('maker_feedback_reviews').useful).toBe(1);
    expect((await reviewer.post(`/maker/feedback/${id}/close`,{closure_note:'We learned how to make the button easier to find.'})).status).toBe(403);
    expect((await owner.post(`/maker/feedback/${id}/close`,{closure_note:'We learned how to make the button easier to find.'})).status).toBe(303);
    expect((await late.post(`/maker/feedback/${id}/reviews`,reviewValues)).status).toBe(409);expect(row('maker_feedback_requests').state).toBe('closed');
    const anon=new Browser();expect((await anon.get(path)).status).toBe(401);
  });
  it('supports report moderation without exposing hidden content',async()=>{
    const admin=await new Browser().admin(),owner=new Browser(),reviewer=new Browser();await admit(admin,owner,'Owner');await admit(admin,reviewer,'Reviewer');
    const response=await owner.post('/maker/feedback/requests',feedbackValues);const path=response.headers.get('location')!,id=path.split('/').pop()!;
    await reviewer.post(`/maker/feedback/${id}/reviews`,reviewValues);const reviewId=String(row('maker_feedback_reviews').id);
    for(let n=0;n<2;n++)expect((await owner.post(`/maker/feedback/reviews/${reviewId}/report`,{reason:'Please review this potentially unhelpful feedback.'})).status).toBe(303);expect(count('maker_feedback_reports')).toBe(1);
    const reportId=String(row('maker_feedback_reports').id);expect((await admin.post(`/maker/admin/reports/${reportId}`,{decision:'hide'})).status).toBe(303);
    expect(row('maker_feedback_reviews').state).toBe('hidden');expect(row('maker_feedback_reports').state).toBe('resolved');
    expect(await (await owner.get(path)).text()).not.toContain(reviewValues.context);
    expect((await admin.post(`/maker/admin/feedback/${id}/hide`)).status).toBe(303);expect((await owner.get(path)).status).toBe(404);
  });
});
