import type { FC, PropsWithChildren } from 'hono/jsx';
import { Burst } from './art';

export interface SeoProps {
  title: string;
  description: string;
  /** Absolute canonical URL for this page. */
  canonical: string;
  siteName: string;
  /** Extra structured data, serialised into a JSON-LD script tag. */
  jsonLd?: unknown;
  noindex?: boolean;
}

export type LayoutProps = PropsWithChildren<
  SeoProps & {
    active?: string;
    /** Where the masthead search posts. Defaults to the product track. */
    searchAction?: string;
  }
>;

const NAV = [
  { href: '/', label: 'Products' },
  { href: '/apis', label: 'APIs' },
  { href: '/about', label: 'About' },
  { href: '/api/v1', label: 'JSON API' },
];

export const Layout: FC<LayoutProps> = ({
  title,
  description,
  canonical,
  siteName,
  jsonLd,
  noindex,
  active,
  searchAction = '/',
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:card" content="summary_large_image" />

      <meta name="theme-color" content="#f3ecdd" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0a0f16" media="(prefers-color-scheme: dark)" />

      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link
        rel="alternate"
        type="application/rss+xml"
        title={`${siteName} — newest listings`}
        href="/feed.xml"
      />
      {/* The headline is the first thing painted, so fetch its face alongside
          the stylesheet rather than after it. */}
      <link
        rel="preload"
        href="/fonts/anton-latin.woff2"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      {/* Earlier design directions are kept at /styles-v1.css and /styles-v2.css. */}
      <link rel="stylesheet" href="/styles.css" />

      {/*
        Applies the saved theme before first paint. Inline and synchronous on
        purpose: deferring it means a flash of the wrong theme.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`,
        }}
      />

      {jsonLd != null && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
    </head>

    <body>
      <a class="skip-link" href="#main">
        Skip to content
      </a>

      {/* Masthead: brand · nav · search · actions, all on one line. */}
      <header class="masthead">
        <div class="masthead-inner">
          <a class="brand" href="/">
            <span class="brand-mark" aria-hidden="true">
              CA
            </span>
            <span class="brand-text">
              <strong>Catholic APIs</strong>
              <small>Discover what's already built</small>
            </span>
          </a>

          <nav class="masthead-nav" aria-label="Main">
            {NAV.map((item) => (
              <a href={item.href} aria-current={active === item.href ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>

          <form class="masthead-search" method="get" action={searchAction} role="search">
            <label class="visually-hidden" for="masthead-q">
              Search the directory
            </label>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2" />
              <line
                x1="13.5"
                y1="13.5"
                x2="18"
                y2="18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <input
              type="search"
              id="masthead-q"
              name="q"
              placeholder="Search apps, APIs, or topics"
              autocomplete="off"
              data-search
            />
            <kbd aria-hidden="true">/</kbd>
          </form>

          <div class="masthead-actions">
            <button
              type="button"
              class="theme-toggle"
              data-theme-toggle
              aria-label="Switch between light and dark theme"
              title="Switch theme"
            >
              <span class="theme-toggle-icon" aria-hidden="true" />
            </button>
            <a class="btn btn-primary" href="/submit">
              Submit
            </a>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer class="site-footer">
        <div class="footer-inner">
          <div class="footer-brand">
            <span class="footer-mark" aria-hidden="true">
              CA
            </span>
            <p class="muted small">
              Catholic APIs
              <br />
              An open, community-ranked directory.
            </p>
          </div>

          <div class="footer-links">
            <p class="footer-title">Browse</p>
            <a href="/">Catholic products</a>
            <a href="/apis">Developer APIs</a>
            <a href="/apis?pricing=free&amp;no_auth=1">Free, no key needed</a>
            <a href="/?sort=new">Recently added</a>
          </div>

          <div class="footer-links">
            <p class="footer-title">Developers</p>
            <a href="/api/v1">JSON API</a>
            <a href="/feed.xml">RSS feed</a>
            <a href="/submit">Submit a listing</a>
            <a href="/about#data">Data &amp; corrections</a>
          </div>

          <div class="footer-links">
            <p class="footer-title">About</p>
            <a href="/about">What this is</a>
            <a href="/about">How ranking works</a>
            <a href="/about#data">Report a problem</a>
          </div>

          <div class="footer-burst">
            <Burst>Vote honestly.</Burst>
          </div>
        </div>

        <div class="footer-legal">
          <p class="muted">
            Not affiliated with the Holy See, any bishops' conference, or any diocese. Every
            listing links to its own publisher — check their terms before shipping.
          </p>
        </div>
      </footer>

      <div class="toast" data-toast role="status" aria-live="polite" hidden />
      <script src="/app.js" defer />
    </body>
  </html>
);
