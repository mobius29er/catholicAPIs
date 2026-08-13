import type { FC } from 'hono/jsx';

/*
  Hand-drawn SVG rather than raster art. The Content-Security-Policy blocks
  every external host, and a bitmap would need a second copy for light mode;
  inline SVG paints from the same custom properties as the rest of the page, so
  it re-inks itself when the theme changes and costs a few kilobytes.
*/

/** Deterministic 32-bit hash, so a listing always draws the same mark. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* Saturated four-colour-process inks for the tiles. */
const MARK_INKS = [
  ['#6d5ce7', '#a78bfa'],
  ['#e8502a', '#f59e5b'],
  ['#1f9d76', '#5ed6a8'],
  ['#c2410c', '#f5a623'],
  ['#1d6fd0', '#5aa2ff'],
  ['#b21f6a', '#f472b6'],
  ['#0f8ea3', '#5ec5c0'],
  ['#8a6a12', '#f5cb5c'],
];

/** First letters of the first two words, so "Church Calendar API" → "CC". */
function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * The coloured app tile from the reference. Real products have logos we cannot
 * host, so each listing gets a stable generated mark instead — same shape and
 * weight in the layout, no invented branding.
 */
export const LogoMark: FC<{ name: string; slug: string }> = ({ name, slug }) => {
  const [from, to] = MARK_INKS[hash(slug) % MARK_INKS.length];
  const id = `mark-${slug}`;

  return (
    <span class="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color={from} />
            <stop offset="100%" stop-color={to} />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill={`url(#${id})`} />
        <text
          x="24"
          y="24"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="19"
          font-weight="700"
          font-family="ui-sans-serif, system-ui, sans-serif"
          fill="#fff"
          opacity="0.95"
        >
          {initials(name)}
        </text>
      </svg>
    </span>
  );
};

/** The small round monogram beside the "by …" line. */
export const Monogram: FC<{ label: string }> = ({ label }) => {
  const [from] = MARK_INKS[hash(label) % MARK_INKS.length];

  return (
    <span class="monogram" aria-hidden="true" style={`background:${from}`}>
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
};

/**
 * The hero: a rain-slicked embankment at night, cathedral spires behind, one
 * lamp lit. Silhouette work in layers — far skyline, cathedral, near buildings,
 * water, figure — so depth comes from tone rather than detail.
 */
export const NoirScene: FC = () => (
  <svg
    class="scene"
    viewBox="0 0 900 560"
    role="img"
    aria-label="A figure in a long coat and hat stands at a railing on a rain-slicked embankment at night, cathedral spires and lit windows behind, one streetlamp burning."
    preserveAspectRatio="xMidYMax meet"
  >
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--scene-sky-top)" />
        <stop offset="65%" stop-color="var(--scene-sky-bottom)" />
      </linearGradient>

      {/* City glow sitting on the horizon behind the buildings. */}
      <radialGradient id="cityGlow" cx="50%" cy="100%" r="70%">
        <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.22" />
        <stop offset="100%" stop-color="var(--amber)" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.75" />
        <stop offset="30%" stop-color="var(--amber)" stop-opacity="0.22" />
        <stop offset="100%" stop-color="var(--amber)" stop-opacity="0" />
      </radialGradient>

      <linearGradient id="lampCone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.2" />
        <stop offset="100%" stop-color="var(--amber)" stop-opacity="0" />
      </linearGradient>

      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--scene-water-top)" />
        <stop offset="100%" stop-color="var(--scene-water-bottom)" />
      </linearGradient>

      {/* Reflections fade as they travel down the water. */}
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.55" />
        <stop offset="100%" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <mask id="reflectionFade">
        <rect x="0" y="404" width="900" height="156" fill="url(#fade)" />
      </mask>

      <pattern id="rain" width="30" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
        <line x1="0" y1="0" x2="0" y2="38" stroke="var(--scene-rain)" stroke-width="1.1" />
        <line x1="15" y1="26" x2="15" y2="60" stroke="var(--scene-rain)" stroke-width="1.1" />
        <line x1="23" y1="6" x2="23" y2="30" stroke="var(--scene-rain)" stroke-width="0.8" />
      </pattern>

      <pattern id="benday" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.15" fill="var(--scene-dot)" />
      </pattern>
    </defs>

    <rect width="900" height="560" fill="url(#sky)" />
    <rect width="900" height="420" fill="url(#benday)" />
    <rect y="150" width="900" height="270" fill="url(#cityGlow)" />

    {/* Far skyline: flat, low contrast, no detail. */}
    <g fill="var(--scene-far)">
      <path d="M0 404V300h34v-34h14v34h30v-58h44v58h26v-92h18v-24h10v24h16v92h40v-46h48v46h30v-74h40v74h34v-120h12v-30h8v30h14v120h44v-52h50v52h32v-86h42v86h30v-40h36v40h44v-70h40v70h38v-104h14v-28h8v28h16v104h48v-46h40v46z" />
    </g>

    {/* The cathedral — the reason this skyline is Catholic and not generic. */}
    <g fill="var(--scene-mid)">
      <path d="M300 404V236h150v168z" />
      <path d="M316 236l-8-30h20l-8 30z" />
      <path d="M434 236l-8-30h20l-8 30z" />
      {/* Twin spires. */}
      <path d="M330 236V150l-14-18V96l22-56 22 56v36l-14 18v86z" />
      <path d="M406 236V150l-14-18V96l22-56 22 56v36l-14 18v86z" />
      {/* Nave roof and the rose window's frame. */}
      <path d="M360 236v-70l15-26 15 26v70z" />
      <circle cx="375" cy="206" r="19" fill="var(--scene-near)" />
    </g>
    {/* Rose window and lancets, lit from within. */}
    <circle cx="375" cy="206" r="13" fill="var(--amber)" opacity="0.55" />
    <g fill="var(--amber)" opacity="0.4">
      <path d="M318 300h14v46h-14zM350 300h14v46h-14zM386 300h14v46h-14zM418 300h14v46h-14z" />
    </g>

    {/* Near blocks, densely lit — this band carries most of the warmth. */}
    <g fill="var(--scene-near)">
      <rect x="0" y="318" width="150" height="86" />
      <rect x="164" y="284" width="118" height="120" />
      <rect x="470" y="300" width="132" height="104" />
      <rect x="620" y="264" width="104" height="140" />
      <rect x="744" y="330" width="156" height="74" />
    </g>
    <g fill="var(--amber)" opacity="0.65">
      {[
        [22, 336], [52, 336], [82, 336], [22, 366], [112, 366], [52, 366],
        [182, 302], [212, 302], [242, 302], [182, 332], [242, 332], [212, 362],
        [488, 318], [518, 318], [578, 318], [488, 348], [548, 348], [578, 378],
        [638, 282], [668, 282], [698, 282], [638, 312], [698, 312], [668, 342], [638, 372],
        [762, 348], [792, 348], [852, 348], [822, 378],
      ].map(([x, y]) => (
        <rect x={x} y={y} width="12" height="17" />
      ))}
    </g>

    {/* The one light in the frame, and the halo the rain gives it. */}
    <circle cx="742" cy="196" r="150" fill="url(#lampGlow)" />
    <path d="M742 206 L666 480 L818 480 Z" fill="url(#lampCone)" />

    <g fill="var(--scene-figure)">
      {/* Lamp: fluted column, scrolled arms, lantern head. */}
      <rect x="737" y="200" width="10" height="264" />
      <rect x="726" y="456" width="32" height="10" />
      <rect x="721" y="464" width="42" height="8" />
      <path d="M718 200h48l-10-16h-28z" />
      <path d="M726 184l6-26h20l6 26z" />
      <path d="M732 158h20l-10-14z" />
      <path d="M714 214c0-10 8-16 16-14l-2 8c-4-1-8 2-8 6z" />
      <path d="M770 214c0-10-8-16-16-14l2 8c4-1 8 2 8 6z" />
    </g>
    <ellipse cx="742" cy="172" rx="9" ry="12" fill="var(--amber)" />

    {/* Water, then the reflections that make it read as wet. */}
    <rect x="0" y="404" width="900" height="156" fill="url(#water)" />
    <g mask="url(#reflectionFade)" opacity="0.85">
      <rect x="737" y="404" width="10" height="150" fill="var(--amber)" opacity="0.5" />
      <g fill="var(--amber)" opacity="0.22">
        {[40, 120, 210, 300, 380, 470, 560, 650, 800, 860].map((x, i) => (
          <rect x={x} y="404" width="9" height={70 + (i % 4) * 26} />
        ))}
      </g>
      <rect x="352" y="404" width="46" height="120" fill="var(--amber)" opacity="0.16" />
    </g>
    {/* Ripples: horizontal breaks across the reflections. */}
    <g stroke="var(--scene-water-line)" stroke-width="2" opacity="0.5">
      {[420, 438, 458, 482, 508, 538].map((y) => (
        <line x1="0" y1={y} x2="900" y2={y} />
      ))}
    </g>

    {/* Embankment railing, in front of the water. */}
    <g fill="var(--scene-figure)">
      <rect x="0" y="418" width="900" height="5" />
      <rect x="0" y="440" width="900" height="5" />
      {[30, 118, 206, 294, 382, 470, 558, 646, 820, 880].map((x) => (
        <rect x={x} y="412" width="7" height="66" />
      ))}
    </g>

    {/* The figure: coat flaring at the hem, shoulders, brimmed hat. */}
    <g fill="var(--scene-figure)">
      <path d="M492 486c-2-64 4-118 13-150 6-22 17-34 35-34s29 12 35 34c9 32 15 86 13 150z" />
      <path d="M528 302c0-6 5-10 12-10s12 4 12 10v10h-24z" />
      <path d="M519 300c0-14 9-24 21-24s21 10 21 24c0 7-3 11-9 13h-24c-6-2-9-6-9-13z" />
      <ellipse cx="540" cy="288" rx="44" ry="8" />
      <path d="M520 278c0-12 9-20 20-20s20 8 20 20z" />
      {/* Coat vent and the line of the shoulders. */}
      <path d="M537 340h6v146h-6z" fill="var(--scene-sky-bottom)" opacity="0.25" />
    </g>

    <rect width="900" height="560" fill="url(#rain)" opacity="0.55" />
  </svg>
);

/**
 * The "POW!" burst, minus the onomatopoeia — a jagged star with a line of text
 * across it. The one piece of unapologetic comic ornament on the page.
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

/** The searchlight motif behind the spotlight panel in the reference. */
export const SpotlightBeam: FC = () => (
  <svg class="beam" viewBox="0 0 260 160" aria-hidden="true" focusable="false" preserveAspectRatio="none">
    <defs>
      <linearGradient id="beamFade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="var(--amber)" stop-opacity="0.3" />
        <stop offset="100%" stop-color="var(--amber)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d="M260 0 L60 160 L200 160 L260 96z" fill="url(#beamFade)" />
  </svg>
);

/**
 * Topic glyphs for the rail. The reference uses a different line icon per
 * topic rather than a coloured dot; these cycle by position.
 */
const TOPIC_PATHS = [
  'M8 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.6V13a3 3 0 0 0 4 2.8V3.9A3 3 0 0 0 8 3Zm4 0a3 3 0 0 1 3 3 3 3 0 0 1 1 5.6V13a3 3 0 0 1-4 2.8V3.9A3 3 0 0 1 12 3Z',
  'M7 6 3 10l4 4M13 6l4 4-4 4',
  'M4 10.5 8 14l8-8',
  'M11 2 4 11h5l-1 7 7-9h-5z',
  'M10 3v14M3 10h14',
  'M4 15V8m4 7V5m4 10V9m4 6V4',
];

export const TopicIcon: FC<{ index: number }> = ({ index }) => {
  const path = TOPIC_PATHS[index % TOPIC_PATHS.length];
  const filled = index % TOPIC_PATHS.length === 0 || index % TOPIC_PATHS.length === 3;

  return (
    <svg class="topic-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d={path}
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
