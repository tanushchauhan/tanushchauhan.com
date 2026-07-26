/**
 * Widget glyphs. These were emoji, which looked dull and inconsistent: every
 * platform renders them in its own house style, they ignore the card's colour,
 * and they sit on the text baseline rather than optically centred.
 *
 * Hand-drawn strokes instead. They inherit `currentColor`, so each card tints
 * its own icon, and they stay legible at 14px where a detailed glyph would mush.
 */
const Svg = ({ children, filled = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const MoonIcon = () => (
  <Svg>
    <path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3Z" />
  </Svg>
);

/** A miniature contribution grid, with the same falloff as the heatmap below it. */
export const GridIcon = () => (
  <Svg filled>
    <rect x="3" y="3" width="5" height="5" rx="1.5" opacity="0.45" />
    <rect x="9.5" y="3" width="5" height="5" rx="1.5" />
    <rect x="16" y="3" width="5" height="5" rx="1.5" opacity="0.45" />
    <rect x="3" y="9.5" width="5" height="5" rx="1.5" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" opacity="0.45" />
    <rect x="16" y="9.5" width="5" height="5" rx="1.5" />
    <rect x="3" y="16" width="5" height="5" rx="1.5" opacity="0.45" />
    <rect x="9.5" y="16" width="5" height="5" rx="1.5" />
    <rect x="16" y="16" width="5" height="5" rx="1.5" opacity="0.45" />
  </Svg>
);

/** The git commit graph glyph: a node on a branch line. */
export const CommitIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3.6" />
    <path d="M12 2v6.4M12 15.6V22" />
  </Svg>
);

export const CubeIcon = () => (
  <Svg>
    <path d="M12 2.6 20.2 7v10L12 21.4 3.8 17V7z" />
    <path d="M3.8 7 12 11.6 20.2 7M12 11.6v9.8" />
  </Svg>
);
