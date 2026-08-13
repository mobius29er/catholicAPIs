import type { FC, PropsWithChildren } from 'hono/jsx';

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

export type LayoutProps = PropsWithChildren<SeoProps & { active?: string }>;

const NAV = [
  { href: '/', label: 'Products' },
  { href: '/apis', label: 'APIs' },
  { href: '/submit', label: 'Submit' },
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

      <meta name="theme-color" content="#f4f6f8" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0b0e12" media="(prefers-color-scheme: dark)" />

      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="alternate" type="application/rss+xml" title={`${siteName} — newest listings`} href="/feed.xml" />
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

      <header class="site-header">
        <div class="wrap header-inner">
          <a class="brand" href="/">
            <span class="brand-mark" aria-hidden="true">
              CA
            </span>
            <span class="brand-text">
              <strong>Catholic APIs</strong>
              <small>Ranked by the people who use them</small>
            </span>
          </a>

          <nav class="site-nav" aria-label="Main">
            {NAV.map((item) => (
              <a href={item.href} aria-current={active === item.href ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>

          <button
            type="button"
            class="theme-toggle"
            data-theme-toggle
            aria-label="Switch between light and dark theme"
            title="Switch theme"
          >
            <span class="theme-toggle-icon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer class="site-footer">
        <div class="wrap footer-inner">
          <div>
            <p class="footer-title">Catholic APIs</p>
            <p class="muted">
              An open directory of Catholic software — the apps people use and the APIs they're
              built from. Community-ranked; corrections welcome.
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
            <p class="footer-title">For developers</p>
            <a href="/api/v1">JSON API</a>
            <a href="/feed.xml">RSS feed</a>
            <a href="/submit">Submit a listing</a>
            <a href="/about#data">Data &amp; corrections</a>
          </div>
        </div>

        <div class="wrap footer-legal">
          <p class="muted">
            Not affiliated with the Holy See or any diocese. Every listing links to its own
            publisher — check their terms before shipping.
          </p>
        </div>
      </footer>

      <div class="toast" data-toast role="status" aria-live="polite" hidden />
      <script src="/app.js" defer />
    </body>
  </html>
);
