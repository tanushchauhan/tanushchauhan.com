/**
 * The app and document icons, drawn rather than shipped as pictures.
 *
 * An app icon is a tile with a glyph on it. The tile is CSS: a rounded square
 * with a gradient, a sheen across its top half and a rim, all read from
 * variables, which is what lets the Control Center's glass setting restyle
 * every icon at once (clear turns them into frosted monochrome, tinted into
 * the site's own orange). The glyph is a small inline SVG in white.
 *
 * Folders and documents are shapes, not tiles, so they skip the background
 * and draw themselves.
 *
 * `icon` is a name from the table below. A path is still accepted and comes
 * out as a plain <img>, which is how the monochrome link glyphs and the
 * avatar get through unchanged.
 */
import clsx from "clsx";

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };

const petals = ["#ffcc00", "#ff9500", "#ff3b30", "#ff2d55", "#af52de", "#007aff", "#34c759", "#5ac8fa"];

const GLYPHS = {
  finder: (
    <>
      <path d="M32 0h32v64H32z" fill="#fff" opacity=".22" />
      <path d="M32 4c-3 10-3 22 0 34" strokeWidth="2.5" {...stroke} stroke="var(--ic-line, #0b3d78)" opacity=".7" />
      <path d="M21 25v8M43 25v8" strokeWidth="4.5" {...stroke} stroke="var(--ic-line, #0b3d78)" />
      <path d="M16 43c9 8 23 8 32 0" strokeWidth="4" {...stroke} stroke="var(--ic-line, #0b3d78)" />
    </>
  ),
  safari: (
    <>
      <circle cx="32" cy="32" r="23" fill="#fff" opacity=".16" />
      <circle cx="32" cy="32" r="23" strokeWidth="2.5" {...stroke} opacity=".9" />
      <path d="M32 11v4M32 49v4M11 32h4M49 32h4" strokeWidth="2" {...stroke} opacity=".7" />
      <path d="M45 19L36 36l-8-8z" fill="var(--ic-needle, #ff3b30)" />
      <path d="M19 45l9-17 8 8z" fill="#fff" />
    </>
  ),
  photos: (
    <>
      {petals.map((c, i) => (
        <ellipse
          key={c}
          cx="32"
          cy="18"
          rx="6.5"
          ry="13"
          fill={`var(--ic-mono, ${c})`}
          opacity=".85"
          transform={`rotate(${i * 45} 32 32)`}
        />
      ))}
    </>
  ),
  terminal: (
    <>
      <path d="M16 21l11 11-11 11" strokeWidth="5" {...stroke} />
      <path d="M33 45h15" strokeWidth="5" {...stroke} />
    </>
  ),
  contact: (
    <>
      <circle cx="32" cy="32" r="19" strokeWidth="3" {...stroke} opacity=".9" />
      <circle cx="32" cy="26" r="6.5" fill="currentColor" />
      <path d="M20 45a12 12 0 0 1 24 0z" fill="currentColor" />
    </>
  ),
  guestbook: (
    <path
      d="M15 17h34a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H31l-10 8v-8h-6a4 4 0 0 1-4-4V21a4 4 0 0 1 4-4z"
      fill="currentColor"
    />
  ),
  settings: (
    <>
      <circle cx="32" cy="32" r="8" strokeWidth="5" {...stroke} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect key={a} x="29" y="9" width="6" height="9" rx="2.5" fill="currentColor" transform={`rotate(${a} 32 32)`} />
      ))}
    </>
  ),
};

/* shapes: no tile behind them */
const SHAPES = {
  folder: (
    <>
      <path
        d="M5 16a4 4 0 0 1 4-4h15l6 6h25a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"
        fill="var(--folder-back, #2f8fe0)"
      />
      <path d="M5 25h54v23a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="var(--folder-front, #6cc1ff)" />
      <path d="M5 25h54v3H5z" fill="#fff" opacity=".35" />
    </>
  ),
  txt: (
    <>
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="#fff" />
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" strokeWidth="1.5" {...stroke} stroke="#c4c4cc" />
      <path d="M38 5v12h12z" fill="#dcdce3" />
      <path d="M19 30h26M19 38h26M19 46h17" strokeWidth="3" {...stroke} stroke="#a0a0aa" />
    </>
  ),
  image: (
    <>
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="#fff" />
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" strokeWidth="1.5" {...stroke} stroke="#c4c4cc" />
      <path d="M38 5v12h12z" fill="#dcdce3" />
      <rect x="18" y="26" width="28" height="22" rx="3" fill="#8fd0ff" />
      <path d="M18 48l9-11 6 6 5-5 8 10z" fill="#3ea15c" />
      <circle cx="39" cy="32" r="3" fill="#ffd23f" />
    </>
  ),
  trash: (
    <>
      <rect x="13" y="13" width="38" height="6" rx="3" fill="#b9b9c3" />
      <path d="M27 9h10a2 2 0 0 1 2 2v2H25v-2a2 2 0 0 1 2-2z" fill="#b9b9c3" />
      <path d="M17 21h30l-2.4 31a4 4 0 0 1-4 3.7H23.4a4 4 0 0 1-4-3.7z" fill="#dedee4" />
      <path d="M24 26v25M32 26v25M40 26v25" strokeWidth="2.5" {...stroke} stroke="#aeaeb8" />
    </>
  ),
};

const AppIcon = ({ icon, alt = "", className }) => {
  if (!icon) return null;

  if (icon.includes("/")) return <img src={icon} alt={alt} className={className} />;

  const shape = SHAPES[icon];
  const glyph = shape ?? GLYPHS[icon];
  if (!glyph) return null;

  return (
    <span
      className={clsx("app-icon", className)}
      data-icon={icon}
      data-shape={shape ? "bare" : undefined}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <svg viewBox="0 0 64 64" focusable="false">
        {glyph}
      </svg>
    </span>
  );
};

export default AppIcon;
