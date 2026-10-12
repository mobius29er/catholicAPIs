import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Child } from 'hono/jsx';
import type { Env } from './types';
import { Layout } from './views/layout';
import { AD_PLACEMENTS, isActionKey, localMakerEnabled, newToken, safeEqual, safeExternalUrl, tokenHash, validAdMonth, validLaunchDate } from './maker-db';
import type { AdPlacement, AdRequest, FeedbackAccess, FeedbackRequest, FeedbackReview, Launch, MakerSession } from './maker-db';

type MakerEnv = { Bindings: Env; Variables: { csrf: string; session: MakerSession | null; form: Record<string, string> } };
type C = Context<MakerEnv>;
class FormError extends Error { constructor(message: string, public status: 400 | 401 | 403 | 404 | 409 = 400) { super(message); } }
export const makerApp = new Hono<MakerEnv>();
const nowSeconds = () => Math.floor(Date.now() / 1000);
const cookieOptions = (c: C) => ({ httpOnly: true, sameSite: 'Strict' as const, secure: new URL(c.req.url).protocol === 'https:', path: '/', maxAge: 7 * 86400 });
const field = (c: C, name: string, min = 1, max = 2000): string => {
  const value = (c.get('form')[name] ?? '').trim();
  if (value.length < min || value.length > max) throw new FormError(`${name.replace(/_/g, ' ')} must be ${min}–${max} characters.`);
  return value;
};
const key = (c: C) => { const value = field(c, 'action_key', 36, 36); if (!isActionKey(value)) throw new FormError('Reload the form and try again.'); return value; };
const urlField = (c: C, name: string) => { const url = safeExternalUrl(field(c, name)); if (!url) throw new FormError('Enter a public http:// or https:// product URL without login details.'); return url; };
const all = async <T,>(c: C, sql: string, ...values: (string | number)[]) => (await c.env.DB.prepare(sql).bind(...values).all<T>()).results;
const first = <T,>(c: C, sql: string, ...values: (string | number)[]) => c.env.DB.prepare(sql).bind(...values).first<T>();
const run = (c: C, sql: string, ...values: (string | number)[]) => c.env.DB.prepare(sql).bind(...values).run();
const hidden = (csrf: string, actionKey = crypto.randomUUID()) => <><input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="action_key" value={actionKey} /></>;
const button = (label: string, secondary = false) => <button class={`btn ${secondary ? 'btn-secondary' : 'btn-primary'}`} type="submit">{label}</button>;
const textInput = (name: string, label: string, options: { type?: string; placeholder?: string; max?: number; value?: string; required?: boolean; id?: string } = {}) => <div class="field"><label for={options.id ?? name}>{label}</label><input id={options.id ?? name} name={name} type={options.type ?? 'text'} placeholder={options.placeholder} maxlength={options.max ?? 160} value={options.value ?? ''} required={options.required !== false} /></div>;
const textarea = (name: string, label: string, max = 2000, id = name) => <div class="field"><label for={id}>{label}</label><textarea id={id} name={name} rows={3} maxlength={max} required /></div>;
const notices: Record<string, string> = { saved: 'Draft saved on this computer.', checkout: 'Test checkout completed. No money was charged.', scheduled: 'Launch date saved locally. Nothing will publish automatically.', service: 'Request added to the local review queue.', ad: 'Advertising request saved. No booking or charge has been made.', newsletter: 'Your opt-in is saved in the local mock queue. No email was sent.', access: 'Your beta access request is waiting for a local admin.', joined: 'You’re in the free feedback beta.', review: 'Feedback shared with beta members.', useful: 'Feedback marked useful.', closed: 'Feedback request closed. Your summary is saved.', admin: 'Local admin changes saved.', reported: 'Report saved for local admin review.', logout: 'Local session ended.' };
function page(c: C, title: string, content: Child, active = 'maker') {
  const notice = notices[c.req.query('notice') ?? ''];
  const session = c.get('session');
  return c.html(<Layout title={`${title} — FidesHunt`} description="Local FidesHunt maker preview" canonical={new URL(c.req.path, c.req.url).href} siteName={c.env.SITE_NAME ?? 'FidesHunt'} active={active} noindex>
    <div class="wrap page maker-shell">
      <nav class="maker-tabs" aria-label="Maker tools"><a href="/maker" aria-current={active === 'maker' ? 'page' : undefined}>Overview</a><a href="/launch" aria-current={active === 'launch' ? 'page' : undefined}>Launch</a><a href="/advertise" aria-current={active === 'advertise' ? 'page' : undefined}>Advertise</a><a href="/feedback" aria-current={active === 'feedback' ? 'page' : undefined}>Feedback beta</a></nav>
      {notice && <div class="alert" role="status">{notice}</div>}
      {content}
      <footer class="maker-footer"><a href="/maker/newsletter">Newsletter</a> · <a href="/maker/admin">Local admin</a>{session && <details><summary>Local session</summary><p>{session.display_name} · ID: <code>{session.account_id}</code>{session.is_admin ? ' · Admin' : ''}</p><form method="post" action="/maker/logout">{hidden(c.get('csrf'))}{button('End local session', true)}</form></details>}</footer>
    </div>
  </Layout>);
}

/** The directory can use this only when rendering an approved local sponsor form. */
export function makerCsrf(c: Context<{ Bindings: Env }>): string {
  if (!localMakerEnabled(c.env.LOCAL_PREVIEW, c.req.url)) return '';
  let token = getCookie(c, 'fh_local_csrf');
  if (!token || !/^[\da-f-]{72}$/.test(token)) {
    token = newToken();
    setCookie(c, 'fh_local_csrf', token, { httpOnly: true, sameSite: 'Strict', secure: new URL(c.req.url).protocol === 'https:', path: '/', maxAge: 7 * 86400 });
  }
  return token;
}

makerApp.use('*', async (c, next) => {
  if (!/^\/(maker(?:\/|$)|launch(?:\/|$)|advertise(?:\/|$)|feedback(?:\/|$))/.test(c.req.path)) return next();
  if (!localMakerEnabled(c.env.LOCAL_PREVIEW, c.req.url)) return c.text('Not found', 404);
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex, nofollow');
  let csrf = getCookie(c, 'fh_local_csrf');
  if (!csrf || !/^[\da-f-]{72}$/.test(csrf)) { csrf = newToken(); if (c.req.method === 'GET') setCookie(c, 'fh_local_csrf', csrf, cookieOptions(c)); }
  c.set('csrf', csrf);
  const sessionToken = getCookie(c, 'fh_local_session');
  // An unregistered browser token lets simultaneous first saves share one identity.
  // No account or other database state is created by viewing a form.
  if (c.req.method === 'GET' && (!sessionToken || !/^[\da-f-]{72}$/.test(sessionToken))) {
    setCookie(c, 'fh_local_session', newToken(), cookieOptions(c));
  }
  const session = sessionToken && /^[\da-f-]{72}$/.test(sessionToken) ? await first<MakerSession>(c, `SELECT s.*, a.display_name FROM maker_sessions s JOIN maker_accounts a ON a.id=s.account_id WHERE token_hash=? AND expires_at>?`, await tokenHash(sessionToken), nowSeconds()) : null;
  c.set('session', session || null);
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    if (c.req.method !== 'POST') return c.text('Method not allowed', 405);
    if (c.req.header('origin') !== new URL(c.req.url).origin || c.req.header('sec-fetch-site') === 'cross-site') throw new FormError('This form must be submitted from the local preview.', 403);
    if (!(c.req.header('content-type') ?? '').startsWith('application/x-www-form-urlencoded')) throw new FormError('Use the form on this page.');
    if (Number(c.req.header('content-length') ?? 0) > 32000) throw new FormError('The form is too large.');
    const body = await c.req.text();
    if (body.length > 32000) throw new FormError('The form is too large.');
    const params = new URLSearchParams(body);
    const form: Record<string, string> = {};
    for (const [name, value] of params) { if (name in form) throw new FormError('Duplicate form fields are not supported.'); form[name] = value; }
    if (!getCookie(c, 'fh_local_csrf') || !safeEqual(form.csrf ?? '', csrf)) throw new FormError('This form expired. Reload the page and try again.', 403);
    c.set('form', form);
  }
  await next();
});

async function identity(c: C, create = false): Promise<MakerSession> {
  const existing = c.get('session');
  if (existing) return existing;
  if (!create) throw new FormError('Open your maker dashboard in the browser where you saved this item.', 401);
  const priorToken = getCookie(c, 'fh_local_session');
  let token = priorToken && /^[\da-f-]{72}$/.test(priorToken) ? priorToken : newToken();
  const expired = await first<{ expires_at: number }>(c, 'SELECT expires_at FROM maker_sessions WHERE token_hash=?', await tokenHash(token));
  if (expired && expired.expires_at <= nowSeconds()) token = newToken();
  const hash = await tokenHash(token);
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  const displayName = (c.get('form').display_name ?? '').trim().slice(0, 60) || 'Local maker';
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR IGNORE INTO maker_accounts (id, display_name) VALUES (?,?)').bind(id, displayName),
    c.env.DB.prepare('INSERT OR IGNORE INTO maker_sessions (token_hash,account_id,expires_at) VALUES (?,?,?)').bind(hash, id, nowSeconds() + 7 * 86400),
  ]);
  setCookie(c, 'fh_local_session', token, cookieOptions(c));
  const session = { account_id: id, display_name: displayName, is_admin: 0, token_hash: hash };
  c.set('session', session); return session;
}
async function admin(c: C): Promise<MakerSession> {
  const session = await identity(c);
  if (!session.is_admin) throw new FormError('Local admin access is required.', 403);
  return session;
}
async function betaAccess(c: C): Promise<MakerSession> {
  const session = await identity(c);
  const access = await first<FeedbackAccess>(c, 'SELECT * FROM maker_feedback_access WHERE account_id=?', session.account_id);
  if (!session.is_admin && access?.state !== 'active') throw new FormError('This free beta is invite-only. Request access first.', 403);
  return session;
}
async function ownedLaunch(c: C): Promise<Launch> {
  const session = await identity(c);
  const launch = await first<Launch>(c, 'SELECT * FROM maker_launches WHERE id=? AND owner_id=?', c.req.param('id') ?? '', session.account_id);
  if (!launch) throw new FormError('Launch not found in your local session.', 404);
  return launch;
}

makerApp.get('/maker', async c => {
  const session = c.get('session');
  const launches = session ? await all<Launch>(c, 'SELECT * FROM maker_launches WHERE owner_id=? ORDER BY created_at DESC', session.account_id) : [];
  const ads = session ? await all<AdRequest>(c, 'SELECT a.*, (SELECT count(*) FROM maker_ad_clicks x WHERE x.request_id=a.id) AS clicks FROM maker_ad_requests a WHERE owner_id=? ORDER BY created_at DESC', session.account_id) : [];
  return page(c, 'Maker dashboard', <><div class="page-heading"><h1>Maker dashboard</h1><p class="lede">Bring your Catholic product to people who’ll use it.</p></div>
    <div class="maker-grid"><section class="maker-card"><h2>Your launches</h2>{launches.length ? <ul class="maker-list">{launches.map(l => <li><a href={`/maker/launch/${l.id}`}><strong>{l.name}</strong></a><span>{l.state === 'paid_mock' ? 'Ready to schedule' : l.state}{l.launch_date ? ` · ${l.launch_date}` : ''}</span></li>)}</ul> : <p>No launches yet. Start with a name, a link, and a short description.</p>}<a class="btn btn-primary" href="/launch">Create a launch · $29</a><p class="hint">USD launch price. Checkout is simulated; billing cadence is undecided.</p></section>
    <section class="maker-card"><h2>Free feedback beta</h2><p>A small, invite-only space for specific, useful feedback from fellow makers.</p><a class="btn btn-secondary" href="/feedback">Open feedback beta</a><p class="hint">Free access. No paid membership or guaranteed reviews.</p></section></div>
    <section class="maker-card"><h2>Advertising requests</h2>{ads.length ? <ul class="maker-list">{ads.map(a => <li><strong>{a.name}</strong><span>{AD_PLACEMENTS[a.placement]} · {a.month} · {a.state} · {a.clicks} test clicks</span></li>)}</ul> : <p>No requests yet. Explore monthly sponsor availability.</p>}<a href="/advertise">View monthly placements →</a></section>
  </>);
});

makerApp.get('/launch', c => page(c, 'Create a launch', <><h1>Launch your product</h1><ol class="maker-steps" aria-label="Launch steps"><li aria-current="step">1. Draft</li><li>2. Test checkout</li><li>3. Choose a date</li></ol>
  <div class="maker-grid"><section class="maker-card"><h2>What are you building?</h2><form class="form" method="post" action="/maker/launch">{hidden(c.get('csrf'))}{textInput('name', 'Product name', { max: 120, placeholder: 'Your product' })}{textInput('tagline', 'One-line description', { max: 160, placeholder: 'Who it helps and what it does' })}{textInput('homepage_url', 'Product website', { type: 'url', placeholder: 'https://', max: 2000 })}{textarea('description', 'A little more about your product')}{!c.get('session') && textInput('display_name', 'Your display name', { max: 60, required: false })}{button('Save draft & continue')}<p class="hint">Saving creates a local test session in this browser. No account credentials needed.</p></form></section>
  <aside class="maker-card"><h2>$29 USD launch</h2><p>A dedicated launch draft and scheduling workflow. Community votes always determine organic ranking.</p><p>Optional editorial and video help can be requested for manual review. No inclusion, delivery date, or extra price is promised.</p><p class="hint">This preview has no real checkout. Billing cadence is still undecided.</p></aside></div></>, 'launch'));

makerApp.post('/maker/launch', async c => {
  const name = field(c, 'name', 2, 120), tagline = field(c, 'tagline', 5, 160), url = urlField(c, 'homepage_url'), description = field(c, 'description', 10, 2000), actionKey = key(c);
  const session = await identity(c, true); const id = crypto.randomUUID();
  await run(c, `INSERT OR IGNORE INTO maker_launches (id,owner_id,action_key,name,tagline,homepage_url,description) VALUES (?,?,?,?,?,?,?)`, id, session.account_id, actionKey, name, tagline, url, description);
  const result = await first<{id:string}>(c, 'SELECT id FROM maker_launches WHERE owner_id=? AND action_key=?', session.account_id, actionKey);
  return c.redirect(`/maker/launch/${result!.id}?notice=saved`, 303);
});
makerApp.get('/maker/launch/:id', async c => {
  const launch = await ownedLaunch(c);
  const services = await all<{kind:string;state:string}>(c, 'SELECT kind,state FROM maker_services WHERE launch_id=?', launch.id);
  const step = launch.state === 'draft' ? 2 : launch.state === 'paid_mock' ? 3 : 4;
  return page(c, launch.name, <><h1>{launch.name}</h1><p class="lede">{launch.tagline}</p><ol class="maker-steps" aria-label="Launch steps"><li>1. Draft saved</li><li aria-current={step === 2 ? 'step' : undefined}>2. {step > 2 ? 'Test checkout done' : 'Test checkout'}</li><li aria-current={step >= 3 ? 'step' : undefined}>3. {step === 4 ? 'Date saved' : 'Choose a date'}</li></ol>
    <div class="maker-grid"><section class="maker-card">{launch.state === 'draft' ? <><h2>Test checkout · $29 USD</h2><p>Simulate the launch checkout. No payment details are collected and no money is charged.</p><form method="post" action={`/maker/launch/${launch.id}/checkout`}>{hidden(c.get('csrf'))}<label class="field"><input type="checkbox" name="simulation" value="1" required /> I understand this is a simulated checkout.</label>{button('Complete test checkout')}</form></> : launch.state === 'paid_mock' ? <><h2>Choose your launch date</h2><p>Your test checkout is complete. Pick a date within the next 180 days.</p><form class="form" method="post" action={`/maker/launch/${launch.id}/schedule`}>{hidden(c.get('csrf'))}{textInput('launch_date', 'Launch date (UTC)', { type: 'date', value: new Date().toISOString().slice(0,10) })}{button('Save launch date')}</form></> : <><h2>Launch date saved</h2><p class="lede">{launch.launch_date}</p><p>This is a local schedule record. Publishing requires a separate real-world review and setup.</p><a href="/maker">Back to your dashboard →</a></>}</section>
    <section class="maker-card"><h2>Optional extra help</h2><p>Request a manual review for editorial coverage or a video. These aren’t included or guaranteed, and no additional price is set.</p>{(['editorial','video'] as const).map(kind => { const service = services.find(s => s.kind === kind); return <div class="maker-service"><h3>{kind === 'editorial' ? 'Editorial coverage' : 'Video feature'}</h3>{service ? <p>Request {service.state}</p> : <form method="post" action={`/maker/launch/${launch.id}/service`}>{hidden(c.get('csrf'))}<input type="hidden" name="kind" value={kind} />{button(`Request ${kind} review`, true)}</form>}</div>; })}</section></div>
    <details class="maker-card"><summary>View your draft</summary><p>{launch.description}</p><a href={launch.homepage_url} target="_blank" rel="noopener noreferrer">{launch.homepage_url}</a></details>
  </>, 'launch');
});
makerApp.post('/maker/launch/:id/checkout', async c => {
  const launch = await ownedLaunch(c); key(c);
  if (field(c, 'simulation') !== '1') throw new FormError('Confirm that this is a test checkout.');
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR IGNORE INTO maker_checkouts (id,launch_id,amount_cents,currency) VALUES (?,?,2900,\'USD\')').bind(crypto.randomUUID(), launch.id),
    c.env.DB.prepare("UPDATE maker_launches SET state='paid_mock' WHERE id=? AND state='draft'").bind(launch.id),
  ]);
  return c.redirect(`/maker/launch/${launch.id}?notice=checkout`,303);
});
makerApp.post('/maker/launch/:id/schedule', async c => {
  const launch = await ownedLaunch(c); key(c); const date = field(c, 'launch_date',10,10);
  if (!validLaunchDate(date)) throw new FormError('Choose a real date from today through the next 180 days.');
  if (launch.state === 'draft') throw new FormError('Complete the test checkout before scheduling.',409);
  if (launch.state === 'scheduled' && launch.launch_date !== date) throw new FormError('This launch already has a saved date.',409);
  await run(c, "UPDATE maker_launches SET state='scheduled',launch_date=? WHERE id=? AND state='paid_mock'", date, launch.id);
  return c.redirect(`/maker/launch/${launch.id}?notice=scheduled`,303);
});
makerApp.post('/maker/launch/:id/service', async c => {
  const launch = await ownedLaunch(c); key(c); const kind = field(c,'kind');
  if (!['editorial','video'].includes(kind)) throw new FormError('Choose editorial or video help.');
  await run(c, 'INSERT OR IGNORE INTO maker_services (id,launch_id,kind) VALUES (?,?,?)', crypto.randomUUID(),launch.id,kind);
  return c.redirect(`/maker/launch/${launch.id}?notice=service`,303);
});

makerApp.get('/advertise', async c => {
  const monthQuery = c.req.query('month') ?? new Date().toISOString().slice(0,7);
  const month = validAdMonth(monthQuery) ? monthQuery : new Date().toISOString().slice(0,7);
  const inventory = await all<{placement:AdPlacement;capacity:number;used:number}>(c, `SELECT i.*, (SELECT count(*) FROM maker_ad_requests a WHERE a.month=i.month AND a.placement=i.placement AND a.state='approved') AS used FROM maker_ad_inventory i WHERE month=?`,month);
  const sponsored = await all<AdRequest>(c,"SELECT * FROM maker_ad_requests WHERE month=? AND state='approved'",month);
  return page(c,'Monthly advertising',<><h1>Advertise on FidesHunt</h1><p class="lede">Reach people discovering Catholic products. Choose a month and request a clearly labeled sponsor placement.</p>
    <div class="maker-grid"><section class="maker-card"><h2>Request a placement</h2><form class="form" method="post" action="/maker/advertise">{hidden(c.get('csrf'))}{textInput('name','Product name',{max:120})}{textInput('tagline','Short sponsor message',{max:160})}{textInput('target_url','Product website',{type:'url',max:2000,placeholder:'https://'})}{textInput('month','Preferred month',{type:'month',value:month})}<div class="field"><label for="placement">Placement</label><select id="placement" name="placement"><option value="sidebar">Directory sponsor</option><option value="newsletter">Newsletter sponsor</option></select></div>{button('Send local request')}<p class="hint">Prices are unset. A request doesn’t reserve inventory, start a subscription, or authorize a charge.</p></form></section>
    <section class="maker-card"><h2>Availability · {month}</h2><form class="form" method="get" action="/advertise">{textInput('month','View month',{type:'month',value:month,id:'view-month'})}{button('Check availability',true)}</form><ul class="maker-list">{Object.entries(AD_PLACEMENTS).map(([placement,label])=>{const slot=inventory.find(i=>i.placement===placement);return <li><strong>{label}</strong><span>{Math.max(0,(slot?.capacity??1)-(slot?.used??0))} of {slot?.capacity??1} local slots available</span></li>})}</ul><p>Sponsored placements are labeled. They don’t change the organic leaderboard or buy votes.</p><p class="hint">Approval here is only a local inventory test. No ad is published to the live site.</p></section></div>
    {sponsored.length>0&&<section class="maker-card"><h2>Approved placement previews</h2>{sponsored.map(ad=><article class="maker-sponsored"><span class="tag">Sponsored · Local preview</span><h3>{ad.name}</h3><p>{ad.tagline}</p><p class="hint">{AD_PLACEMENTS[ad.placement]} · {ad.month}</p><form method="post" action={`/maker/advertise/${ad.id}/click`}>{hidden(c.get('csrf'))}{button('Record a test placement click',true)}</form><p class="hint">Counts a local click only; doesn’t open the advertiser’s site.</p></article>)}</section>}
  </>,'advertise');
});
makerApp.post('/maker/advertise',async c=>{
  const name=field(c,'name',2,120),tagline=field(c,'tagline',5,160),url=urlField(c,'target_url'),month=field(c,'month',7,7),placement=field(c,'placement'),actionKey=key(c);
  if(!validAdMonth(month)||!Object.hasOwn(AD_PLACEMENTS,placement))throw new FormError('Choose a valid placement and a month within the next year.');
  const session=await identity(c,true);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR IGNORE INTO maker_ad_inventory (month,placement,capacity) VALUES (?,?,1)').bind(month,placement),
    c.env.DB.prepare('INSERT OR IGNORE INTO maker_ad_requests (id,owner_id,action_key,name,tagline,target_url,month,placement) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),session.account_id,actionKey,name,tagline,url,month,placement),
  ]);
  return c.redirect('/maker?notice=ad',303);
});
makerApp.post('/maker/advertise/:id/click',async c=>{
  const actionKey=key(c);
  const ad=await first<AdRequest>(c,"SELECT * FROM maker_ad_requests WHERE id=? AND state='approved'",c.req.param('id'));
  if(!ad)throw new FormError('That placement is unavailable.',404);
  await run(c,'INSERT OR IGNORE INTO maker_ad_clicks (id,request_id,action_key) VALUES (?,?,?)',crypto.randomUUID(),ad.id,actionKey);
  return page(c,'Test click recorded',<section class="maker-card"><h1>Test click recorded</h1><p>This click belongs to the labeled sponsor placement for {ad.name}. Organic votes are unchanged.</p><a href={`/advertise?month=${ad.month}`}>Back to advertising →</a></section>,'advertise');
});

makerApp.get('/maker/ad-click/:id', async c => {
  const ad = await first<AdRequest>(c, "SELECT * FROM maker_ad_requests WHERE id=? AND state='approved' AND month=?", c.req.param('id'), new Date().toISOString().slice(0,7));
  if (!ad) throw new FormError('This sponsor placement is no longer active.',404);
  return page(c, ad.name, <section class="maker-card narrow"><span class="tag">Sponsored</span><h1>{ad.name}</h1><p>{ad.tagline}</p><p>You’re about to visit {new URL(ad.target_url).hostname}. This sponsor link is separate from organic votes.</p><form method="post" action={`/maker/ad-click/${ad.id}`}>{hidden(c.get('csrf'))}{button('Visit sponsored product')}</form></section>);
});
makerApp.post('/maker/ad-click/:id', async c => {
  const actionKey = key(c);
  const ad = await first<AdRequest>(c, "SELECT * FROM maker_ad_requests WHERE id=? AND state='approved' AND month=?", c.req.param('id'), new Date().toISOString().slice(0,7));
  if (!ad || !safeExternalUrl(ad.target_url)) throw new FormError('This sponsor placement is no longer active.',404);
  await run(c,'INSERT OR IGNORE INTO maker_ad_clicks (id,request_id,action_key) VALUES (?,?,?)',crypto.randomUUID(),ad.id,actionKey);
  c.header('Referrer-Policy','no-referrer');
  return c.redirect(ad.target_url,303);
});

makerApp.get('/maker/newsletter',c=>page(c,'Newsletter',<section class="maker-card narrow"><h1>Good Catholic products, in your inbox</h1><p class="lede">Try the newsletter signup flow.</p><p>This local preview stores your opt-in in a mock queue. No email is sent and you aren’t added to a live mailing list.</p><form class="form" method="post" action="/maker/newsletter">{hidden(c.get('csrf'))}{textInput('email','Email address',{type:'email',max:254,value:(c.req.query('email')??'').slice(0,254)})}<label class="field"><input type="checkbox" name="consent" value="1" required /> I agree to save this newsletter opt-in locally.</label>{button('Save local opt-in')}</form></section>));
makerApp.post('/maker/newsletter',async c=>{
  const email=field(c,'email',3,254).toLowerCase();key(c);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||c.get('form').consent!=='1')throw new FormError('Enter a valid email and confirm the local opt-in.');
  await run(c,'INSERT OR IGNORE INTO maker_newsletter (id,email) VALUES (?,?)',crypto.randomUUID(),email);
  return c.redirect('/maker/newsletter?notice=newsletter',303);
});

makerApp.get('/feedback',async c=>{
  const session=c.get('session');
  const access=session?await first<FeedbackAccess>(c,'SELECT * FROM maker_feedback_access WHERE account_id=?',session.account_id):null;
  if(!session||(!session.is_admin&&access?.state!=='active'))return page(c,'Free feedback beta',<><h1>Build better, together</h1><p class="lede">Free, invite-only feedback for Catholic makers.</p><section class="maker-card narrow"><h2>A small circle. Useful feedback.</h2><p>Ask a focused question, try someone’s product, and share what worked, what got in the way, and what you’d improve.</p><p>No paid membership, promised review count, or ranking advantage. Feedback is private to invited beta members and local admins.</p>{access?.state==='invited'&&Number(access.invite_expires_at)>nowSeconds()?<form method="post" action="/maker/feedback/accept">{hidden(c.get('csrf'))}{button('Accept free beta invitation')}</form>:access?.state==='requested'?<p role="status">Your access request is waiting for a local admin. Your local ID: <code>{session?.account_id}</code></p>:access?.state==='revoked'?<p>Your beta access has been revoked. Contact the local admin.</p>:<form class="form" method="post" action="/maker/feedback/access">{hidden(c.get('csrf'))}{!session&&textInput('display_name','Your display name',{max:60})}{button('Request free beta access')}<p class="hint">No email is sent. The local admin reviews access requests in this preview.</p></form>}</section></>,'feedback');
  const requests=await all<FeedbackRequest>(c,"SELECT r.*,a.display_name,(SELECT count(*) FROM maker_feedback_reviews f WHERE f.request_id=r.id AND f.state='visible') AS review_count FROM maker_feedback_requests r JOIN maker_accounts a ON a.id=r.owner_id WHERE r.state!='hidden' ORDER BY r.created_at DESC");
  return page(c,'Feedback beta',<><h1>Feedback beta <span class="tag">Free</span></h1><p class="lede">Give specific, constructive feedback. Close the loop when you’ve learned what you need.</p><div class="maker-grid"><section class="maker-card"><h2>Ask for feedback</h2><form class="form" method="post" action="/maker/feedback/requests">{hidden(c.get('csrf'))}{textInput('name','Product name',{max:120})}{textInput('target_url','Product or test link',{type:'url',max:2000})}{textInput('audience','Who is it for?',{max:200})}{textarea('question','What would you like feedback on?',1000)}{button('Post feedback request')}<p class="hint">Visible to invited beta members and local admins. Don’t include passwords, private user data, or confidential test accounts.</p></form></section><section class="maker-card"><h2>From the community</h2>{requests.length?<ul class="maker-list">{requests.map(r=><li><a href={`/feedback/${r.id}`}><strong>{r.name}</strong></a><p>{r.question}</p><span>{r.display_name} · {r.review_count} reviews · {r.state}</span></li>)}</ul>:<p>No requests yet. Yours can be the first.</p>}</section></div></>,'feedback');
});
makerApp.post('/maker/feedback/access',async c=>{
  key(c);const session=await identity(c,true);
  const current=await first<FeedbackAccess>(c,'SELECT * FROM maker_feedback_access WHERE account_id=?',session.account_id);
  if(current?.state==='revoked')throw new FormError('Local admin approval is required to restore revoked access.',403);
  await run(c,"INSERT INTO maker_feedback_access (account_id,state) VALUES (?,'requested') ON CONFLICT(account_id) DO UPDATE SET state='requested',invite_expires_at=NULL,updated_at=datetime('now') WHERE state='invited' AND invite_expires_at<=?",session.account_id,nowSeconds());
  return c.redirect('/feedback?notice=access',303);
});
makerApp.post('/maker/feedback/accept',async c=>{
  key(c);const session=await identity(c);
  const access=await first<FeedbackAccess>(c,'SELECT * FROM maker_feedback_access WHERE account_id=?',session.account_id);
  if(access?.state!=='active'&&(access?.state!=='invited'||Number(access.invite_expires_at)<=nowSeconds()))throw new FormError('This invitation is unavailable or expired.',403);
  await run(c,"UPDATE maker_feedback_access SET state='active',updated_at=datetime('now') WHERE account_id=? AND state='invited' AND invite_expires_at>?",session.account_id,nowSeconds());
  return c.redirect('/feedback?notice=joined',303);
});
makerApp.post('/maker/feedback/requests',async c=>{
  const session=await betaAccess(c),name=field(c,'name',2,120),url=urlField(c,'target_url'),audience=field(c,'audience',5,200),question=field(c,'question',10,1000),actionKey=key(c);
  await run(c,'INSERT OR IGNORE INTO maker_feedback_requests (id,owner_id,action_key,name,target_url,audience,question) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),session.account_id,actionKey,name,url,audience,question);
  const result=await first<{id:string}>(c,'SELECT id FROM maker_feedback_requests WHERE owner_id=? AND action_key=?',session.account_id,actionKey);
  return c.redirect(`/feedback/${result!.id}`,303);
});
makerApp.get('/feedback/:id',async c=>{
  const session=await betaAccess(c);
  const request=await first<FeedbackRequest>(c,"SELECT r.*,a.display_name FROM maker_feedback_requests r JOIN maker_accounts a ON a.id=r.owner_id WHERE r.id=? AND r.state!='hidden'",c.req.param('id'));
  if(!request)throw new FormError('Feedback request not found.',404);
  const reviews=await all<FeedbackReview>(c,"SELECT r.*,a.display_name FROM maker_feedback_reviews r JOIN maker_accounts a ON a.id=r.reviewer_id WHERE r.request_id=? AND r.state='visible' ORDER BY r.created_at",request.id);
  const own=request.owner_id===session.account_id;
  const hasReviewed=await first<{id:string}>(c,'SELECT id FROM maker_feedback_reviews WHERE request_id=? AND reviewer_id=?',request.id,session.account_id);
  return page(c,request.name,<><a href="/feedback">← Feedback beta</a><h1>{request.name}</h1><p class="lede">{request.question}</p><p>{request.display_name} · For {request.audience} · {request.state}</p><p><a href={request.target_url} target="_blank" rel="noopener noreferrer">Try the product ↗</a></p>{request.state==='closed'&&<section class="maker-card"><h2>What the maker learned</h2><p>{request.closure_note}</p></section>}
    <div class="maker-grid"><section class="maker-card"><h2>{reviews.length} {reviews.length===1?'review':'reviews'}</h2>{reviews.length===0&&<p>No feedback yet.</p>}{reviews.map(review=><article class="maker-review"><h3>{review.display_name}{review.useful?' · Marked useful':''}</h3><dl><dt>What I tried</dt><dd>{review.context}</dd><dt>What worked</dt><dd>{review.worked}</dd><dt>What was confusing</dt><dd>{review.friction}</dd><dt>One improvement</dt><dd>{review.suggestion}</dd></dl>{own&&!review.useful&&<form method="post" action={`/maker/feedback/reviews/${review.id}/useful`}>{hidden(c.get('csrf'))}{button('Mark useful',true)}</form>}<details><summary>Report this feedback</summary><form class="form" method="post" action={`/maker/feedback/reviews/${review.id}/report`}>{hidden(c.get('csrf'))}{textarea('reason',`Why should an admin review this feedback?`,500,`reason-${review.id}`)}{button('Send report',true)}</form></details></article>)}</section>
    <section class="maker-card">{request.state!=='open'?<><h2>Request closed</h2><p>This maker has finished collecting feedback.</p></>:own?<><h2>Close the loop</h2><p>When you have enough feedback, share what you learned or plan to improve.</p><form class="form" method="post" action={`/maker/feedback/${request.id}/close`}>{hidden(c.get('csrf'))}{textarea('closure_note','What did you learn?',1000)}{button('Close feedback request')}</form></>:hasReviewed?<><h2>Thanks for reviewing</h2><p>You’ve already shared feedback on this request.</p></>:<><h2>Share useful feedback</h2><form class="form" method="post" action={`/maker/feedback/${request.id}/reviews`}>{hidden(c.get('csrf'))}{textarea('context','What did you try?',1000)}{textarea('worked','What worked well?',1000)}{textarea('friction','What was confusing or difficult?',1000)}{textarea('suggestion','What’s one improvement you’d suggest?',1000)}{button('Share feedback')}<p class="hint">Be kind and specific. Describe your experience; don’t post personal information.</p></form></>}</section></div>
  </>,'feedback');
});
makerApp.post('/maker/feedback/:id/reviews',async c=>{
  const session=await betaAccess(c);key(c);
  const request=await first<FeedbackRequest>(c,"SELECT * FROM maker_feedback_requests WHERE id=? AND state!='hidden'",c.req.param('id'));
  if(!request)throw new FormError('Feedback request not found.',404);
  if(request.owner_id===session.account_id)throw new FormError('You can’t review your own request.',403);
  const existing=await first<{id:string}>(c,'SELECT id FROM maker_feedback_reviews WHERE request_id=? AND reviewer_id=?',request.id,session.account_id);
  if(existing)return c.redirect(`/feedback/${request.id}?notice=review`,303);
  if(request.state!=='open')throw new FormError('This feedback request is closed.',409);
  const context=field(c,'context',5,1000),worked=field(c,'worked',5,1000),friction=field(c,'friction',5,1000),suggestion=field(c,'suggestion',5,1000);
  const result=await run(c,"INSERT OR IGNORE INTO maker_feedback_reviews (id,request_id,reviewer_id,context,worked,friction,suggestion) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM maker_feedback_requests WHERE id=? AND state='open')",crypto.randomUUID(),request.id,session.account_id,context,worked,friction,suggestion,request.id);
  if(!result.meta.changes)throw new FormError('The request changed. Reload it before reviewing.',409);
  return c.redirect(`/feedback/${request.id}?notice=review`,303);
});
makerApp.post('/maker/feedback/reviews/:id/useful',async c=>{
  const session=await betaAccess(c);key(c);
  const review=await first<{request_id:string}>(c,"SELECT r.request_id FROM maker_feedback_reviews r JOIN maker_feedback_requests q ON q.id=r.request_id WHERE r.id=? AND q.owner_id=? AND q.state!='hidden' AND r.state='visible'",c.req.param('id'),session.account_id);
  if(!review)throw new FormError('Only the request owner can mark this feedback useful.',403);
  await run(c,'UPDATE maker_feedback_reviews SET useful=1 WHERE id=?',c.req.param('id'));
  return c.redirect(`/feedback/${review.request_id}?notice=useful`,303);
});
makerApp.post('/maker/feedback/:id/close',async c=>{
  const session=await betaAccess(c);key(c);const note=field(c,'closure_note',10,1000);
  const request=await first<FeedbackRequest>(c,"SELECT * FROM maker_feedback_requests WHERE id=? AND owner_id=? AND state!='hidden'",c.req.param('id'),session.account_id);
  if(!request)throw new FormError('Only the owner can close this request.',403);
  await run(c,"UPDATE maker_feedback_requests SET state='closed',closure_note=? WHERE id=? AND state='open'",note,request.id);
  return c.redirect(`/feedback/${request.id}?notice=closed`,303);
});
makerApp.post('/maker/feedback/reviews/:id/report',async c=>{
  const session=await betaAccess(c);key(c);const reason=field(c,'reason',10,500);
  const review=await first<FeedbackReview>(c,"SELECT r.* FROM maker_feedback_reviews r JOIN maker_feedback_requests q ON q.id=r.request_id WHERE r.id=? AND r.state='visible' AND q.state!='hidden'",c.req.param('id'));
  if(!review)throw new FormError('Feedback not found.',404);
  await run(c,'INSERT OR IGNORE INTO maker_feedback_reports (id,review_id,reporter_id,reason) VALUES (?,?,?,?)',crypto.randomUUID(),review.id,session.account_id,reason);
  return c.redirect(`/feedback/${review.request_id}?notice=reported`,303);
});

makerApp.get('/maker/admin',async c=>{
  const session=c.get('session');
  if(!session?.is_admin)return page(c,'Local admin',<section class="maker-card narrow"><h1>Local admin</h1><p>Use the test-only admin key configured for this local preview. This isn’t a production account or a real password.</p><form class="form" method="post" action="/maker/admin/login">{hidden(c.get('csrf'))}{textInput('admin_key','Local admin key',{type:'password',max:200})}{button('Open local admin')}</form><p class="hint">Admin access is separate from a maker session and is never granted by a client-supplied role.</p></section>);
  const pane=['access','ads','launches','feedback','newsletter'].includes(c.req.query('tab')??'')?c.req.query('tab')!:'access';
  let content:Child;
  if(pane==='access'){
    const accounts=await all<{id:string;display_name:string;state:string;invite_expires_at:number}>(c,"SELECT a.id,a.display_name,coalesce(f.state,'none') AS state,f.invite_expires_at FROM maker_accounts a LEFT JOIN maker_feedback_access f ON f.account_id=a.id ORDER BY a.created_at DESC");
    content=<section class="maker-card"><h2>Free beta access</h2><p>Invite local makers for seven days; they must accept before entering the beta. Revocation blocks all beta content and actions immediately.</p>{accounts.map(a=><article class="maker-admin-row"><h3>{a.display_name}</h3><p class="hint">{a.id} · {a.state}{a.state==='invited'&&a.invite_expires_at<=nowSeconds()?' (expired)':''}</p><form method="post" action="/maker/admin/access">{hidden(c.get('csrf'))}<input type="hidden" name="account_id" value={a.id}/><input type="hidden" name="state" value={a.state==='active'||a.state==='invited'?'revoked':'invited'}/>{button(a.state==='active'||a.state==='invited'?'Revoke beta access':'Invite to free beta',true)}</form></article>)}</section>;
  }else if(pane==='ads'){
    const ads=await all<AdRequest>(c,'SELECT a.*, (SELECT count(*) FROM maker_ad_clicks x WHERE x.request_id=a.id) AS clicks FROM maker_ad_requests a ORDER BY created_at DESC');
    content=<><section class="maker-card"><h2>Monthly inventory</h2><form class="form" method="post" action="/maker/admin/inventory">{hidden(c.get('csrf'))}{textInput('month','Month',{type:'month',value:new Date().toISOString().slice(0,7)})}<div class="field"><label for="placement">Placement</label><select id="placement" name="placement"><option value="sidebar">Directory sponsor</option><option value="newsletter">Newsletter sponsor</option></select></div>{textInput('capacity','Total slots (0–20)',{type:'number',value:'1',max:2})}{button('Set local inventory',true)}</form></section><section class="maker-card"><h2>Advertising requests</h2><p>Prices remain unset. Approval allocates local test inventory only.</p>{ads.length===0&&<p>No requests yet.</p>}{ads.map(a=><article class="maker-admin-row"><h3>{a.name}</h3><p>{a.month} · {AD_PLACEMENTS[a.placement]} · {a.state} · {a.clicks} test clicks</p><p>{a.tagline}</p><a href={a.target_url} target="_blank" rel="noopener noreferrer">Product website</a><form method="post" action={`/maker/admin/ads/${a.id}`}>{hidden(c.get('csrf'))}<div class="field"><label for={`state-${a.id}`}>Decision</label><select id={`state-${a.id}`} name="state"><option value="approved">Approve local placement</option><option value="declined">Decline / remove local placement</option></select></div>{button('Save decision',true)}</form></article>)}</section></>;
  }else if(pane==='launches'){
    const launches=await all<Launch>(c,'SELECT * FROM maker_launches ORDER BY created_at DESC');
    const services=await all<{id:string;name:string;kind:string;state:string}>(c,'SELECT s.*,l.name FROM maker_services s JOIN maker_launches l ON l.id=s.launch_id ORDER BY s.created_at DESC');
    content=<><section class="maker-card"><h2>Local launches</h2><p>No launch is published from this preview.</p><ul class="maker-list">{launches.map(l=><li><strong>{l.name}</strong><span>{l.state} · {l.launch_date??'No date'} · $29 USD simulated</span></li>)}</ul></section><section class="maker-card"><h2>Editorial & video requests</h2>{services.length===0&&<p>No manual service requests yet.</p>}{services.map(s=><article class="maker-admin-row"><h3>{s.name} · {s.kind}</h3><p>{s.state}</p><form method="post" action={`/maker/admin/services/${s.id}`}>{hidden(c.get('csrf'))}<div class="field"><label for={`state-${s.id}`}>Status</label><select id={`state-${s.id}`} name="state"><option value="reviewing">Reviewing</option><option value="completed">Completed (local record)</option><option value="declined">Declined</option></select></div>{button('Update local status',true)}</form></article>)}</section></>;
  }else if(pane==='feedback'){
    const reports=await all<{id:string;review_id:string;reason:string;state:string;name:string}>(c,"SELECT p.*,q.name FROM maker_feedback_reports p JOIN maker_feedback_reviews r ON r.id=p.review_id JOIN maker_feedback_requests q ON q.id=r.request_id WHERE p.state='open' ORDER BY p.created_at");
    const requests=await all<FeedbackRequest>(c,'SELECT * FROM maker_feedback_requests ORDER BY created_at DESC');
    content=<><section class="maker-card"><h2>Open feedback reports</h2>{reports.length===0&&<p>No open reports.</p>}{reports.map(r=><article class="maker-admin-row"><h3>{r.name}</h3><p>{r.reason}</p><form method="post" action={`/maker/admin/reports/${r.id}`}>{hidden(c.get('csrf'))}<div class="field"><label for={`decision-${r.id}`}>Decision</label><select id={`decision-${r.id}`} name="decision"><option value="hide">Hide review and resolve report</option><option value="dismiss">Dismiss report</option></select></div>{button('Resolve report',true)}</form></article>)}</section><section class="maker-card"><h2>Feedback moderation</h2>{requests.map(r=><article class="maker-admin-row"><h3>{r.name}</h3><p>{r.question} · {r.state}</p>{r.state!=='hidden'&&<><a href={`/feedback/${r.id}`}>Read request & reviews</a><form method="post" action={`/maker/admin/feedback/${r.id}/hide`}>{hidden(c.get('csrf'))}{button('Hide request from beta',true)}</form></>}</article>)}</section></>;
  }else{
    const subscribers=await all<{email:string;consent_at:string}>(c,'SELECT email,consent_at FROM maker_newsletter ORDER BY consent_at DESC');
    content=<section class="maker-card"><h2>Newsletter mock queue</h2><p>{subscribers.length} local opt-ins. No provider is connected and no email has been sent.</p><ul class="maker-list">{subscribers.map(s=><li><strong>{s.email}</strong><span>Opted in {s.consent_at} UTC · queued locally</span></li>)}</ul></section>;
  }
  return page(c,'Local admin',<><h1>Local admin</h1><nav class="maker-subtabs" aria-label="Admin sections">{['access','ads','launches','feedback','newsletter'].map(tab=><a href={`/maker/admin?tab=${tab}`} aria-current={pane===tab?'page':undefined}>{tab==='access'?'Beta access':tab==='ads'?'Advertising':tab[0].toUpperCase()+tab.slice(1)}</a>)}</nav>{content}</>);
});
makerApp.post('/maker/admin/login',async c=>{
  key(c);const token=field(c,'admin_key',1,200);
  if(!c.env.LOCAL_ADMIN_TOKEN||c.env.LOCAL_ADMIN_TOKEN.length<16||!safeEqual(token,c.env.LOCAL_ADMIN_TOKEN))throw new FormError('The local admin key is incorrect or isn’t configured.',403);
  const session=await identity(c,true);const freshToken=newToken();const hash=await tokenHash(freshToken);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM maker_sessions WHERE token_hash=?').bind(session.token_hash),
    c.env.DB.prepare('INSERT INTO maker_sessions (token_hash,account_id,is_admin,expires_at) VALUES (?,?,1,?)').bind(hash,session.account_id,nowSeconds()+3600),
  ]);
  setCookie(c,'fh_local_session',freshToken,{...cookieOptions(c),maxAge:3600});
  return c.redirect('/maker/admin',303);
});
makerApp.post('/maker/admin/access',async c=>{
  await admin(c);key(c);const id=field(c,'account_id',36,36),state=field(c,'state');
  if(!['invited','revoked'].includes(state)||!await first(c,'SELECT id FROM maker_accounts WHERE id=?',id))throw new FormError('Choose an existing local maker and valid access action.');
  await run(c,"INSERT INTO maker_feedback_access (account_id,state,invite_expires_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET state=excluded.state,invite_expires_at=excluded.invite_expires_at,updated_at=datetime('now')",id,state,nowSeconds()+7*86400);
  return c.redirect('/maker/admin?tab=access&notice=admin',303);
});
makerApp.post('/maker/admin/inventory',async c=>{
  await admin(c);key(c);const month=field(c,'month',7,7),placement=field(c,'placement'),rawCapacity=field(c,'capacity',1,2),capacity=Number(rawCapacity);
  if(!validAdMonth(month)||!Object.hasOwn(AD_PLACEMENTS,placement)||!/^\d+$/.test(rawCapacity)||capacity<0||capacity>20)throw new FormError('Choose a valid month, placement and capacity from 0 to 20.');
  const result=await run(c,"INSERT INTO maker_ad_inventory (month,placement,capacity) VALUES (?,?,?) ON CONFLICT(month,placement) DO UPDATE SET capacity=excluded.capacity WHERE excluded.capacity >= (SELECT count(*) FROM maker_ad_requests WHERE month=? AND placement=? AND state='approved')",month,placement,capacity,month,placement);
  if(!result.meta.changes)throw new FormError('Capacity can’t be below the number of approved placements.',409);
  return c.redirect('/maker/admin?tab=ads&notice=admin',303);
});
makerApp.post('/maker/admin/ads/:id',async c=>{
  await admin(c);key(c);const state=field(c,'state');
  if(!['approved','declined'].includes(state))throw new FormError('Choose approve or decline.');
  const ad=await first<AdRequest>(c,'SELECT * FROM maker_ad_requests WHERE id=?',c.req.param('id'));
  if(!ad)throw new FormError('Ad request not found.',404);
  if(ad.state!==state){
    const result=state==='declined'?await run(c,"UPDATE maker_ad_requests SET state='declined' WHERE id=?",ad.id):await run(c,"UPDATE maker_ad_requests SET state='approved' WHERE id=? AND state!='approved' AND (SELECT count(*) FROM maker_ad_requests WHERE month=? AND placement=? AND state='approved') < (SELECT capacity FROM maker_ad_inventory WHERE month=? AND placement=?)",ad.id,ad.month,ad.placement,ad.month,ad.placement);
    if(!result.meta.changes)throw new FormError('This month’s placement is full. Increase inventory or decline an existing placement first.',409);
  }
  return c.redirect('/maker/admin?tab=ads&notice=admin',303);
});
makerApp.post('/maker/admin/services/:id',async c=>{
  await admin(c);key(c);const state=field(c,'state');
  if(!['reviewing','completed','declined'].includes(state))throw new FormError('Choose a valid review state.');
  const result=await run(c,'UPDATE maker_services SET state=? WHERE id=?',state,c.req.param('id'));
  if(!result.meta.changes)throw new FormError('Service request not found.',404);
  return c.redirect('/maker/admin?tab=launches&notice=admin',303);
});
makerApp.post('/maker/admin/reports/:id',async c=>{
  await admin(c);key(c);const decision=field(c,'decision');
  if(!['hide','dismiss'].includes(decision))throw new FormError('Choose hide or dismiss.');
  const report=await first<{review_id:string;state:string}>(c,'SELECT * FROM maker_feedback_reports WHERE id=?',c.req.param('id'));
  if(!report)throw new FormError('Report not found.',404);
  if(report.state==='open')await c.env.DB.batch([
    ...(decision==='hide'?[c.env.DB.prepare("UPDATE maker_feedback_reviews SET state='hidden' WHERE id=?").bind(report.review_id)]:[]),
    c.env.DB.prepare("UPDATE maker_feedback_reports SET state='resolved' WHERE id=?").bind(c.req.param('id')),
  ]);
  return c.redirect('/maker/admin?tab=feedback&notice=admin',303);
});
makerApp.post('/maker/admin/feedback/:id/hide',async c=>{
  await admin(c);key(c);
  const result=await run(c,"UPDATE maker_feedback_requests SET state='hidden' WHERE id=?",c.req.param('id'));
  if(!result.meta.changes)throw new FormError('Feedback request not found.',404);
  return c.redirect('/maker/admin?tab=feedback&notice=admin',303);
});
makerApp.post('/maker/logout',async c=>{
  const session=c.get('session');
  if(session)await run(c,'DELETE FROM maker_sessions WHERE token_hash=?',session.token_hash);
  deleteCookie(c,'fh_local_session',{path:'/'});
  return c.redirect('/maker?notice=logout',303);
});
makerApp.onError((error,c)=>{
  if(error instanceof FormError)return c.html(<Layout title="Check this form — FidesHunt" description="Local preview form validation" canonical={new URL('/maker',c.req.url).href} siteName="FidesHunt" noindex><div class="wrap narrow page maker-shell"><h1>Check this form</h1><div class="alert alert-error" role="alert"><p>{error.message}</p></div><p>Use your browser’s Back button to keep your form entries, or return to the dashboard.</p><a class="btn btn-secondary" href="/maker">Maker dashboard</a></div></Layout>,error.status);
  console.error('Local maker error',error);
  return c.text('The local preview could not save this action. Try again.',500);
});
