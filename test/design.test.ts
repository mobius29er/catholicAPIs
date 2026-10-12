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

describe('compact product-first layout', () => {
  it('keeps the Catholic audience explicit and real catalog content primary', () => {
    const html=render(jsx(Home,{result,filters,stats}));
    expect(html).toContain('THE CATHOLIC PRODUCT COMMUNITY');
    expect(html).toContain('Hallow');
    expect(html).toContain('href="/products/hallow"');
    expect(html).not.toContain('hero-art');
    expect(html).not.toContain('stamp');
    expect(html).not.toContain('No charges, emails');
  });
  it('preserves the organic vote forms and accessible controls', () => {
    const html=render(jsx(Home,{result,filters,stats}));
    expect(html).toContain('action="/products/hallow/vote"');
    expect(html).toContain('aria-label="Upvote Hallow"');
    expect(html).toContain('aria-label="Downvote Hallow"');
    expect(html).toContain('data-vote-score');
  });
  it('keeps launch navigation and maker controls concise', () => {
    const html=render(jsx(Layout,{title:'FidesHunt',description:'Catholic products',canonical:'http://127.0.0.1:8787',siteName:'FidesHunt',active:'/'}));
    expect(html).toContain('href="/launch"');
    expect(html).toContain('href="/maker"');
    expect(html.match(/Local preview/g)).toHaveLength(1);
    expect(html).not.toContain('anton-latin.woff2');
    expect(html).toContain('noindex, nofollow');
  });
  it('keeps developer category links in the API track', () => {
    const html=render(jsx(Home,{result:{...result,listings:[]},filters:{...filters,track:'api'},stats}));
    expect(html).toContain('/apis?category=Liturgical%20Calendar');
    expect(html).toContain('Explore APIs');
  });
  it('preserves partial filtering hooks with refreshed facets', () => {
    const html=render(jsx(ResultsPartial,{result,filters:{...filters,categories:['Prayer']}}));
    expect(html).toContain('id="results"');
    expect(html).toContain('data-fresh-facets');
    expect(html).toContain('data-fresh-sort');
    expect(html).toContain('data-fresh-count');
  });
  it('routes newsletter opt-in to confirmation rather than sending directly', () => {
    const html=render(jsx(Home,{result,filters,stats}));
    expect(html).toContain('action="/maker/newsletter" method="get"');
    expect(html).toContain('Choose your email preferences next.');
  });
  it('escapes product text and search queries', () => {
    const html=render(jsx(Home,{result:{...result,listings:[{...listing,name:'<script>alert(1)</script>'}]},filters:{...filters,q:'<img src=x>'},stats}));
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
  });
});
