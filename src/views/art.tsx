import type { FC } from 'hono/jsx';

/*
  Hand-drawn SVG rather than raster art. The Content-Security-Policy blocks
  every external host, and a bitmap would need to ship two versions for two
  themes; inline SVG paints from the same custom properties as the rest of the
  page, so it re-inks itself when the theme changes and costs a few kilobytes.

  It is silhouette work on purpose — a rain-slicked street, one lamp, one
  figure. Golden-age comic art with a noir subject, which is exactly the
  intersection this design is aiming at.
*/

export const NoirScene: FC = () => (
  <svg
    class="scene"
    viewBox="0 0 800 520"
    role="img"
    aria-label="A figure in a coat and hat standing under a streetlamp on a rain-slicked street, with a city skyline behind."
    preserveAspectRatio="xMidYMax slice"
  >
    <defs>
      {/* Night sky, lightest at the horizon where the city glow sits. */}
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--scene-sky-top)" />
        <stop offset="70%" stop-color="var(--scene-sky-bottom)" />
      </linearGradient>

      {/* The single warm light source. Everything else is silhouette. */}
      <radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.55" />
        <stop offset="45%" stop-color="var(--amber)" stop-opacity="0.14" />
        <stop offset="100%" stop-color="var(--amber)" stop-opacity="0" />
      </radialGradient>

      <linearGradient id="lampCone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.22" />
        <stop offset="100%" stop-color="var(--amber)" stop-opacity="0" />
      </linearGradient>

      {/* Wet tarmac: the scene mirrored and faded into the road. */}
      <linearGradient id="wet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--scene-far)" stop-opacity="0.5" />
        <stop offset="100%" stop-color="var(--scene-far)" stop-opacity="0" />
      </linearGradient>

      <pattern id="rain" width="26" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(14)">
        <line x1="0" y1="0" x2="0" y2="34" stroke="var(--scene-rain)" stroke-width="1" />
        <line x1="13" y1="22" x2="13" y2="52" stroke="var(--scene-rain)" stroke-width="1" />
      </pattern>

      {/* Ben-Day dots over the sky — the halftone the plate would have had. */}
      <pattern id="benday" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.1" fill="var(--scene-dot)" />
      </pattern>
    </defs>

    <rect width="800" height="520" fill="url(#sky)" />
    <rect width="800" height="360" fill="url(#benday)" />

    {/* Far skyline — flattest tone, reads as distance. */}
    <g fill="var(--scene-far)">
      <path d="M0 300h48v-70h16v-34h22v34h18v70h40v-96h54v96h34v-58h30v58h44v-120h20v-26h14v26h18v120h52v-74h46v74h58v-104h40v104h56v-62h34v62h74v-88h32v88h50v240H0z" />
    </g>

    {/* Mid buildings, with lit windows in flat amber. */}
    <g fill="var(--scene-mid)">
      <rect x="30" y="330" width="120" height="190" />
      <rect x="168" y="292" width="96" height="228" />
      <rect x="596" y="316" width="112" height="204" />
      <rect x="724" y="352" width="76" height="168" />
    </g>
    <g fill="var(--amber)" opacity="0.62">
      <rect x="48" y="348" width="11" height="15" />
      <rect x="76" y="348" width="11" height="15" />
      <rect x="48" y="382" width="11" height="15" />
      <rect x="118" y="382" width="11" height="15" />
      <rect x="76" y="416" width="11" height="15" />
      <rect x="186" y="312" width="11" height="15" />
      <rect x="214" y="312" width="11" height="15" />
      <rect x="242" y="346" width="11" height="15" />
      <rect x="186" y="380" width="11" height="15" />
      <rect x="614" y="336" width="11" height="15" />
      <rect x="668" y="336" width="11" height="15" />
      <rect x="642" y="370" width="11" height="15" />
      <rect x="614" y="404" width="11" height="15" />
      <rect x="742" y="372" width="11" height="15" />
      <rect x="770" y="406" width="11" height="15" />
    </g>

    {/* The one light in the frame. */}
    <circle cx="640" cy="188" r="170" fill="url(#lampGlow)" />
    <path d="M640 196 L556 470 L724 470 Z" fill="url(#lampCone)" />

    <g fill="var(--scene-near)">
      <rect x="636" y="196" width="8" height="264" />
      <rect x="622" y="452" width="36" height="10" />
      <path d="M618 186h44l-8-22h-28z" />
    </g>
    <circle cx="640" cy="176" r="9" fill="var(--amber)" />

    {/* Railing along the embankment. */}
    <g stroke="var(--scene-near)" stroke-width="4" fill="none">
      <line x1="0" y1="424" x2="800" y2="424" />
      <line x1="0" y1="446" x2="800" y2="446" />
    </g>
    <g fill="var(--scene-near)">
      {[40, 140, 240, 340, 440, 540, 700, 780].map((x) => (
        <rect x={x} y="414" width="6" height="56" />
      ))}
    </g>

    {/* The figure: coat, hat, shoulders. Nothing else needed. */}
    <g fill="var(--scene-figure)">
      <path d="M356 470c0-58 6-104 14-132 5-18 14-28 30-28s25 10 30 28c8 28 14 74 14 132z" />
      <path d="M372 316c0-16 12-26 28-26s28 10 28 26c0 8-4 12-12 14h-32c-8-2-12-6-12-14z" />
      <ellipse cx="400" cy="304" rx="46" ry="7" />
      <path d="M378 292c0-13 10-22 22-22s22 9 22 22z" />
    </g>

    {/* Reflection, then rain over everything. */}
    <rect x="0" y="470" width="800" height="50" fill="url(#wet)" />
    <g opacity="0.5">
      <rect x="356" y="470" width="88" height="42" fill="var(--scene-figure)" opacity="0.28" />
      <rect x="636" y="462" width="8" height="52" fill="var(--amber)" opacity="0.32" />
    </g>
    <rect width="800" height="520" fill="url(#rain)" opacity="0.5" />
  </svg>
);

/**
 * The "POW!" burst, minus the onomatopoeia. A jagged star with a line of text
 * across it — the one piece of unapologetic comic ornament on the page.
 */
export const Burst: FC<{ children?: unknown }> = ({ children }) => (
  <span class="burst" aria-hidden="true">
    <svg viewBox="0 0 200 130" preserveAspectRatio="none" focusable="false">
      <path
        d="M100 2 118 26 148 12 148 42 182 38 166 64 198 78 168 92 186 118 152 112 150 128 122 112 104 128 88 110 62 126 56 100 22 110 32 84 2 74 28 56 8 32 42 34 40 8 70 22z"
        fill="currentColor"
      />
    </svg>
    <span class="burst-text">{children}</span>
  </span>
);
