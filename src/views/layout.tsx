import type { FC, PropsWithChildren } from 'hono/jsx';
import { MarkInks } from './art';

export interface SeoProps {
  title: string; description: string; canonical: string; siteName: string;
  jsonLd?: unknown; noindex?: boolean;
}
export type LayoutProps = PropsWithChildren<SeoProps & { active?: string; searchAction?: string }>;

export const Layout: FC<LayoutProps> = ({ title, description, canonical, siteName, jsonLd, active, searchAction = '/', children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title><meta name="description" content={description} />
      <meta name="robots" content="noindex, nofollow" /><link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} /><meta property="og:description" content={description} />
      <meta property="og:site_name" content={siteName} /><meta property="og:url" content={canonical} />
      <meta name="theme-color" content="#faf9f6" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="alternate" type="application/rss+xml" title={`${siteName} — newest listings`} href="/feed.xml" />
      <link rel="stylesheet" href="/styles.css" /><link rel="stylesheet" href="/clean.css" />
      {jsonLd != null && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
    </head>
    <body>
      <a class="skip-link" href="#main">Skip to content</a><MarkInks />
      <header class="masthead">
        <div class="masthead-inner">
          <a class="brand" href="/" aria-label="FidesHunt home"><span class="brand-mark" aria-hidden="true">f.</span><strong>FidesHunt</strong></a>
          <nav class="masthead-nav" aria-label="Main">
            <a href="/" aria-current={active === '/' ? 'page' : undefined}>Discover</a>
            <a href="/apis" aria-current={active === '/apis' ? 'page' : undefined}>For developers</a>
          </nav>
          <form class="masthead-search" method="get" action={searchAction} role="search">
            <label class="visually-hidden" for="masthead-q">Search the directory</label>
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="m13 13 4 4" stroke="currentColor" stroke-width="1.6" /></svg>
            <input type="search" id="masthead-q" name="q" placeholder="Search Catholic products…" autocomplete="off" data-search /><kbd>/</kbd>
          </form>
          <div class="masthead-actions"><a class="maker-link" href="/maker">Maker dashboard</a><a class="btn btn-primary" href="/launch">Launch a product <span aria-hidden="true">→</span></a></div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer class="site-footer"><div class="footer-simple"><span>FidesHunt <span class="footer-dot">·</span> Good tools. Shared faith.</span><nav aria-label="Footer"><a href="/about">About</a><a href="/submit">Suggest a listing</a><a href="/feed.xml">RSS</a><a href="/api/v1">API</a><a href="/maker/admin">Admin</a></nav></div></footer>
      <span class="preview-badge">Local preview</span>
      <div class="toast" data-toast role="status" aria-live="polite" hidden /><script src="/app.js" defer />
    </body>
  </html>
);
