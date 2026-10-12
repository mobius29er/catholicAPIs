import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { jsx } from 'hono/jsx';
import { Layout } from '../src/views/layout';
import { Home, ResultsPartial } from '../src/views/home';
import type { DirectoryResult, Stats } from '../src/db';
import type { Filters, Listing } from '../src/types';

const filters: Filters = { q:'',track:'product',pricing:[],kind:[],platforms:[],categories:[],languages:[],auth:[],openSource:false,noAuth:false,sort:'top',page:1 };
const listing = { id:1,slug:'hallow',name:'Hallow',tagline:'Prayer and meditation.',track:'product',homepage_url:'https://hallow.com/',categories:['Prayer'],platforms:['ios','web'],pricing:'freemium',open_source:false,official:false,score:4,upvotes:5,downvotes:1,myVote:0,isNew:false,deprecated:false,health_state:'unknown' } as Listing;
const result: DirectoryResult = {listings:[listing],total:1,page:1,pageCount:1,spotlight:null,facets:{pricing:[],kind:[],platforms:[],categories:[],languages:[]}};
const stats: Stats = {total:241,products:156,apis:85,free:210,votes:0,down:0};
const render = (node: ReturnType<typeof jsx>): string => { const html = node.toString(); if (typeof html !== 'string') throw new Error('Expected synchronous layout render'); return html; };

describe('original noir identity with additive maker features', () => {
  it('preserves the original hero, copy, illustration and directory structure', () => {
    const html=render(jsx(Home,{result,filters,stats}));
    expect(html).toContain('New is worth finding.');
    expect(html).toContain('Discover the software');
    expect(html).toContain('Catholics actually use');
    expect(html).toContain('class="hero-art"');
    expect(html).toContain('class="stamp"');
    expect(html).toContain('Good work deserves users.');
    expect(html).toContain('class="columns"');
    expect(html).toContain('class="rail"');
    expect(html).toContain('class="row-by"');
    expect(html).toContain('Top products');
    expect(html).not.toContain('discovery-shell');
    expect(html).not.toContain('category-rail');
  });
  it('preserves original brand, display font and both theme controls', () => {
    const html=render(jsx(Layout,{title:'FidesHunt',description:'Catholic products',canonical:'https://fideshunt.com/',siteName:'FidesHunt',active:'/'}));
    expect(html).toContain('FH');
    expect(html).toContain("Find what&#39;s already built");
    expect(html).toContain('anton-latin.woff2');
    expect(html).toContain('data-theme-toggle');
    expect(html).toContain('localStorage.getItem("theme")');
    expect(html).toContain('prefers-color-scheme: light');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).not.toContain('clean.css');
    expect(html).not.toContain('maker.css');
    expect(html).not.toContain('Local preview');
    expect(html).not.toContain('noindex');
  });
  it('offers a single quiet badge and maker entry only in local preview', () => {
    const html=render(jsx(Layout,{title:'Preview',description:'Preview',canonical:'http://localhost:8787/',siteName:'FidesHunt',localPreview:true}));
    expect(html).toContain('href="/maker"');
    expect(html).toContain('href="/maker.css"');
    expect(html.match(/Local preview/g)).toHaveLength(1);
    expect(html).toContain('noindex, nofollow');
    expect(html).toContain('data-theme-toggle');
  });
  it('preserves organic voting and publisher attribution', () => {
    const html=render(jsx(Home,{result,filters,stats}));
    expect(html).toContain('action="/products/hallow/vote"');
    expect(html).toContain('aria-label="Upvote Hallow"');
    expect(html).toContain('aria-label="Downvote Hallow"');
    expect(html).toContain('data-vote-score');
    expect(html).toContain('hallow.com');
    expect(html).toContain('#1 most recommended');
  });
  it('keeps the original API hero and developer track', () => {
    const html=render(jsx(Home,{result,filters:{...filters,track:'api'},stats}));
    expect(html).toContain('Stop rebuilding the calendar.');
    expect(html).toContain('Every Catholic API');
    expect(html).toContain('Top APIs');
  });
  it('preserves partial filtering hooks and updates the original heading', () => {
    const html=render(jsx(ResultsPartial,{result,filters:{...filters,q:'Hallow'}}));
    expect(html).toContain('id="results"');
    expect(html).toContain('data-fresh-facets');
    expect(html).toContain('data-fresh-sort');
    expect(html).toContain('data-fresh-count');
    expect(html).toContain('Results for Hallow');
  });
  it('retains RSS and JSON discovery instead of replacing the original sidebar', () => {
    const html=render(jsx(Home,{result,filters,stats}));
    expect(html).toContain('href="/feed.xml"');
    expect(html).toContain('href="/api/v1"');
    expect(html).toContain('Trending topics');
  });
  it('keeps paid placements labeled and outside organic ranked rows', () => {
    const ad={id:'ad-id',owner_id:'maker',name:'Sponsor Example',tagline:'A sponsor',target_url:'https://example.com',month:'2026-10',placement:'sidebar' as const,state:'approved'};
    const html=render(jsx(Home,{result,filters,stats,sponsors:[ad],sponsorCsrf:'test-csrf'}));
    expect(html).toContain('Sponsored');
    expect(html).toContain('action="/maker/ad-click/ad-id"');
    expect(html).toContain('value="test-csrf"');
    expect(html.indexOf('Sponsor Example')).toBeGreaterThan(html.indexOf('</ol>'));
  });
  it('escapes product text and search queries', () => {
    const html=render(jsx(Home,{result:{...result,listings:[{...listing,name:'<script>alert(1)</script>'}]},filters:{...filters,q:'<img src=x>'},stats}));
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('scopes every feature style to new feature elements and preserves tokens', () => {
    const css=readFileSync('public/maker.css','utf8');
    expect(css).not.toMatch(/:root|!important|#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\.(?:hero|brand|row|masthead|feed|site-footer)\b/);
    expect(css).toContain('var(--panel)');
    expect(css).toContain('var(--amber-ink)');
  });
  it('preserves original bytes: public/styles.css', () => {
    expect(createHash('sha256').update(readFileSync('public/styles.css')).digest('hex')).toBe('591255391885962f2af396065492faaf6d38c012c2930be5ed277e61cd431867');
  });
  it('preserves original bytes: public/favicon.svg', () => {
    expect(createHash('sha256').update(readFileSync('public/favicon.svg')).digest('hex')).toBe('b44211cf00ed82d631952573c362b35b4fd6a08dbd9995b0622dda41423fc1df');
  });
  it('preserves original bytes: public/fonts/anton-latin.woff2', () => {
    expect(createHash('sha256').update(readFileSync('public/fonts/anton-latin.woff2')).digest('hex')).toBe('d0fa07ff63dd60cbc0e2f58e29c802dca2a5ae0276c999f59c6111ab7bbaec3b');
  });
  it('preserves original bytes: src/views/art.tsx', () => {
    expect(createHash('sha256').update(readFileSync('src/views/art.tsx')).digest('hex')).toBe('c5017467c9f077d603d5cb27fe33ab0cde982a2cff5097df6d6d3d4d606457e5');
  });
  it('preserves original bytes: src/views/components.tsx', () => {
    expect(createHash('sha256').update(readFileSync('src/views/components.tsx')).digest('hex')).toBe('1b268033a1ae5e3aa54261e1c89fd8e019f1dd7bb9677024480dc677c7e71981');
  });
});
