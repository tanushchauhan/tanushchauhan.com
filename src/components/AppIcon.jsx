/**
 * The app and document icons, drawn rather than shipped as pictures.
 *
 * An app icon is a tile with a glyph on it. The tile is CSS: a rounded square
 * with a gradient, a sheen and a rim, all read from variables, which is what
 * lets the Control Center's glass setting restyle every icon at once (clear
 * turns them into frosted monochrome, tinted into the site's own orange). The
 * glyph is inline SVG on a 64 unit grid, and any colour the glass setting has
 * to reach is a variable with the everyday colour as its fallback.
 *
 * Folders, documents and the bin are shapes, not tiles, so they skip the
 * background and draw themselves.
 *
 * `icon` is a name from the tables below. A path is still accepted and comes
 * out as a plain <img>, which is how the monochrome link glyphs and the
 * avatar get through unchanged.
 */
import { useId } from "react";
import clsx from "clsx";

const round = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };

/* evenly spaced teeth or ticks around the centre, drawn pointing up and rotated */
const around = (n, draw) =>
  Array.from({ length: n }, (_, i) => (
    <g key={i} transform={`rotate(${(i * 360) / n} 32 32)`}>
      {draw(i)}
    </g>
  ));

const tooth = (inner, outer, width) => (
  <rect x={32 - width / 2} y={32 - outer} width={width} height={outer - inner} rx={width / 2} />
);

/* clockwise from the top, the order the petals sit in */
const PETALS = ["#f0922e", "#f6cd45", "#9fd342", "#5dcf7b", "#4aa7ef", "#9f8fdf", "#ec76b1", "#ea6461"];

const GLYPHS = {
  finder: (id) => (
    <>
      <defs>
        <linearGradient id={`${id}-card`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfeff" />
          <stop offset="1" stopColor="#e2effb" />
        </linearGradient>
      </defs>
      {/* the white half is an inset card with the profile cut into it */}
      <path
        d="M34.6 5H50a9.3 9.3 0 0 1 9.3 9.3v35.3a9.3 9.3 0 0 1-9.3 9.3h-9.8c-3 0-4.6-2.3-5-5.9l-2.7-16.4h-4.9c-1.3 0-1.7-.9-1.6-2.3.9-10.1 3.6-20.7 8.6-29.3z"
        style={{ fill: `var(--ic-card, url(#${id}-card))`, stroke: "var(--ic-edge, #2358c8)" }}
        strokeWidth=".5"
      />
      <g {...round} style={{ stroke: "var(--ic-line, #0c0c0e)" }} strokeWidth="2.4">
        <path d="M17.8 20v5.6M43.9 20v5.6" />
        <path d="M13.7 42.9Q31 56.1 48 42.9" />
      </g>
    </>
  ),

  safari: (id) => (
    <>
      <defs>
        <linearGradient id={`${id}-dial`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#58b6f0" />
          <stop offset="1" stopColor="#2f6df2" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="25.8"
        style={{ fill: `var(--ic-dial, url(#${id}-dial))`, stroke: "var(--ic-edge, #7fd6ff)" }}
        strokeWidth=".5"
      />
      <g {...round} style={{ stroke: "var(--ic-tick, rgb(255 255 255 / 0.6))" }}>
        {around(36, (i) =>
          i % 2 ? (
            <path d="M32 8.4v2.4" strokeWidth=".9" />
          ) : (
            <path d="M32 8.4v4.6" strokeWidth="1.2" />
          )
        )}
      </g>
      <path d="M48.8 15.6 29.6 29.5l5.1 5.2z" style={{ fill: "var(--ic-needle, #e8352d)" }} />
      <path d="M15.4 48.7 29.6 29.5l5.1 5.2z" style={{ fill: "var(--ic-needle-2, #f5f7fb)" }} />
    </>
  ),

  photos: () => (
    <>
      {PETALS.map((c, i) => (
        <rect
          key={c}
          className="petal"
          x="24.8"
          y="6.5"
          width="14.4"
          height="21.5"
          rx="7.2"
          style={{ fill: `var(--ic-mono, ${c})` }}
          transform={`rotate(${i * 45} 32 32)`}
        />
      ))}
    </>
  ),

  terminal: () => (
    <>
      <path d="M12.9 13.8l10.3 6.4-10.3 6.6" {...round} stroke="currentColor" strokeWidth="2.7" />
      <rect x="25.6" y="30.9" width="13.6" height="2.4" rx="1.2" style={{ fill: "var(--ic-cursor, #6d6d72)" }} />
    </>
  ),

  contact: () => (
    <>
      {/* the index tabs down the right edge; the tile's rounded corner clips them */}
      <g style={{ opacity: "var(--ic-tab-opacity, 1)" }}>
        <rect x="56.3" y="0" width="7.7" height="21.4" style={{ fill: "var(--ic-mono, #52bdf5)" }} />
        <rect x="56.3" y="21.4" width="7.7" height="21.2" style={{ fill: "var(--ic-mono, #ef8b33)" }} />
        <rect x="56.3" y="42.6" width="7.7" height="21.4" style={{ fill: "var(--ic-mono, #5fd955)" }} />
        <path d="M56.2 0v64" style={{ stroke: "var(--ic-edge, #2b3b48)" }} strokeWidth=".45" />
      </g>
      <circle cx="28.1" cy="32" r="20.4" style={{ fill: "var(--ic-soft, #aaa899)" }} />
      <circle cx="28.1" cy="27.2" r="8.2" fill="currentColor" />
      <path d="M15.4 45.5c2.6-5.5 23-5.5 25.6 0 .5 3-5 5.8-12.8 5.8s-13.3-2.8-12.8-5.8z" fill="currentColor" />
    </>
  ),

  guestbook: () => (
    <>
      <ellipse cx="32" cy="30.8" rx="23.8" ry="19.4" fill="currentColor" />
      <path
        d="M14.2 38.4c1.8 4.6.4 8.8-2.4 11.2-.6.5-.3 1.2.5 1.1 3.1-.3 5.7-1.4 7.9-3.3z"
        fill="currentColor"
      />
    </>
  ),

  settings: () => (
    <>
      {/* the small gear sits behind the large one and shows between its spokes */}
      <g fill="currentColor" opacity=".45">
        <circle cx="32" cy="32" r="13.25" fill="none" stroke="currentColor" strokeWidth="3.1" />
        {around(24, () => tooth(14.2, 16.9, 1.6))}
      </g>
      <g fill="currentColor">
        <circle cx="32" cy="32" r="20.85" fill="none" stroke="currentColor" strokeWidth="3.5" />
        {around(36, () => tooth(21.8, 25.8, 1.9))}
        <path d="M32 32h20M32 32l-10 17.3M32 32l-10-17.3" {...round} stroke="currentColor" strokeWidth="2.6" />
        <circle cx="32" cy="32" r="2.8" />
      </g>
      <circle cx="32" cy="32" r="1.1" style={{ fill: "var(--ic-b, #6e6e73)" }} />
    </>
  ),
};

/* shapes: no tile behind them */
const SHAPES = {
  folder: () => (
    <>
      <path
        d="M5 16a4 4 0 0 1 4-4h15l6 6h25a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"
        fill="var(--folder-back, #2f8fe0)"
      />
      <path d="M5 25h54v23a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="var(--folder-front, #6cc1ff)" />
      <path d="M5 25h54v3H5z" fill="#fff" opacity=".35" />
    </>
  ),
  txt: () => (
    <>
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="#fff" />
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" {...round} stroke="#c4c4cc" strokeWidth="1.5" />
      <path d="M38 5v12h12z" fill="#dcdce3" />
      <path d="M19 30h26M19 38h26M19 46h17" {...round} stroke="#a0a0aa" strokeWidth="3" />
    </>
  ),
  image: () => (
    <>
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="#fff" />
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" {...round} stroke="#c4c4cc" strokeWidth="1.5" />
      <path d="M38 5v12h12z" fill="#dcdce3" />
      <rect x="18" y="26" width="28" height="22" rx="3" fill="#8fd0ff" />
      <path d="M18 48l9-11 6 6 5-5 8 10z" fill="#3ea15c" />
      <circle cx="39" cy="32" r="3" fill="#ffd23f" />
    </>
  ),
  /* a frosted bin, darker at the top where the rim shades it */
  trash: (id, full) => (
    <>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b8b90" />
          <stop offset="1" stopColor="#e9e9ed" />
        </linearGradient>
        <linearGradient id={`${id}-well`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a4a4a9" />
          <stop offset="1" stopColor="#cfcfd3" />
        </linearGradient>
      </defs>
      <path
        d="M8.8 11.5h46.4l-3.4 42a4.6 4.6 0 0 1-4.6 4.3H16.8a4.6 4.6 0 0 1-4.6-4.3z"
        fill={`url(#${id}-body)`}
      />
      <rect x="8.6" y="7" width="46.8" height="9" rx="4.5" fill="#f5f5f7" />
      <rect x="10" y="8.3" width="44" height="6.4" rx="3.2" fill={`url(#${id}-well)`} />
      {/* with something in it, crumpled paper sits in the well and over the rim */}
      {full && (
        <g stroke="#b9b9c0" strokeWidth=".5" strokeLinejoin="round">
          <path d="M14.5 13.6c-.6-3.4 1.3-6.8 4.9-7.6 2.1-2.6 6.4-2.4 8.2.3 2.8-.4 5 1.7 5 4.4l.4 2.9z" fill="#fbfbfc" />
          <path d="M31.4 13.6c-.5-4.2 1.6-8.4 5.6-9.4 3-.8 5.6.6 6.7 2.9 3.2-.2 5.7 2.4 5.5 5.3l-.2 1.2z" fill="#f2f2f4" />
          <path d="M24.8 13.6c.2-3 2.6-5 5.4-4.7 2.2.2 3.9 2 4.1 4.2l.1.5z" fill="#e9e9ee" />
          <path d="M21 6.8l2.4 2.1M39.2 6.2l-1.1 3.3M44.6 8.8l-2.7 1.8" fill="none" />
        </g>
      )}
    </>
  ),
};

const AppIcon = ({ icon, alt = "", className }) => {
  // gradient ids have to be unique on the page, and the same icon can appear
  // in the dock, a Finder window and Spotlight at once
  const id = `ic${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (!icon) return null;
  if (icon.includes("/")) return <img src={icon} alt={alt} className={className} />;

  // "trash-full" is the bin with paper in it
  const full = icon === "trash-full";
  const name = full ? "trash" : icon;
  const shape = SHAPES[name];
  const draw = shape ?? GLYPHS[name];
  if (!draw) return null;

  return (
    <span
      className={clsx("app-icon", className)}
      data-icon={name}
      data-shape={shape ? "bare" : undefined}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <svg viewBox="0 0 64 64" focusable="false">
        {draw(id, full)}
      </svg>
    </span>
  );
};

export default AppIcon;
