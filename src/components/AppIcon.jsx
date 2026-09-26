/**
 * App and document icons, drawn in SVG over a CSS tile so the glass setting
 * can restyle them. A path instead of a name renders as a plain <img>.
 */
import { useId } from "react";
import clsx from "clsx";

const around = (n, draw) =>
  Array.from({ length: n }, (_, i) => (
    <g key={i} transform={`rotate(${(i * 360) / n} 32 32)`}>
      {draw(i)}
    </g>
  ));

/**
 * One flat colour with the detail cut out of it. Clear and tinted glass drop
 * every icon to a single tint, so detail drawn as a second colour disappears;
 * a hole shows the tile through and survives.
 */
const cut = (id, shape) => (
  <>
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      {shape}
    </mask>
    <rect width="64" height="64" fill="var(--ic-glyph, #ffffff)" mask={`url(#${id})`} />
  </>
);

const GLYPHS = {
  // a two pane browser: the sidebar and the files beside it
  finder: (id) =>
    cut(
      id,
      <>
        <rect x="8" y="13" width="48" height="38" rx="7" fill="#fff" />
        <g fill="#000">
          <rect x="26" y="20" width="23" height="24" rx="3" />
          <rect x="13" y="21" width="8" height="3.2" rx="1.6" />
          <rect x="13" y="28.4" width="8" height="3.2" rx="1.6" />
          <rect x="13" y="35.8" width="8" height="3.2" rx="1.6" />
        </g>
      </>
    ),

  // a bookmark, starred: the reading list
  safari: (id) =>
    cut(
      id,
      <>
        <path
          d="M18 8h28a5 5 0 0 1 5 5v37a2 2 0 0 1-3.05 1.71L32 44.1 16.05 53.71A2 2 0 0 1 13 52V13a5 5 0 0 1 5-5z"
          fill="#fff"
        />
        <path
          d="M32 16.5 34.47 22.6 41.04 23.06 35.99 27.3 37.58 33.69 32 30.2 26.42 33.69 28.01 27.3 22.96 23.06 29.53 22.6Z"
          fill="#000"
        />
      </>
    ),

  // an iris: six blades closing on an open hexagon
  photos: (id) =>
    cut(
      id,
      <>
        <circle cx="32" cy="32" r="21" fill="#fff" />
        <g fill="#000">
          <path d="M32 23.5 39.36 27.75 39.36 36.25 32 40.5 24.64 36.25 24.64 27.75Z" />
          {around(6, () => (
            <path
              d="M32 23.5 14.7 13.5"
              fill="none"
              stroke="#000"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          ))}
        </g>
      </>
    ),

  terminal: () => (
    <g style={{ color: "var(--ic-glyph, #ffffff)" }}>
      <path
        d="M18 21 28.5 31.5 18 42"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="33" y="37" width="14" height="5" rx="2.5" fill="currentColor" opacity=".75" />
    </g>
  ),

  // an address card
  contact: (id) =>
    cut(
      id,
      <>
        <rect x="7" y="15" width="50" height="34" rx="6" fill="#fff" />
        <g fill="#000">
          <circle cx="21" cy="27.5" r="5.4" />
          <path d="M13.5 41.8c0-4.3 3.4-6.8 7.5-6.8s7.5 2.5 7.5 6.8a1.2 1.2 0 0 1-1.2 1.2H14.7a1.2 1.2 0 0 1-1.2-1.2z" />
          <rect x="34" y="24" width="15" height="3.2" rx="1.6" />
          <rect x="34" y="30.4" width="15" height="3.2" rx="1.6" />
          <rect x="34" y="36.8" width="10" height="3.2" rx="1.6" />
        </g>
      </>
    ),

  guestbook: (id) =>
    cut(
      id,
      <>
        <g fill="#fff">
          <rect x="6" y="11" width="52" height="34" rx="9" />
          <path d="M16 36h15L18.4 54.6a1.5 1.5 0 0 1-2.4-.9z" />
        </g>
        <g fill="#000">
          <rect x="16" y="20.5" width="32" height="3.8" rx="1.9" />
          <rect x="16" y="29" width="22" height="3.8" rx="1.9" />
        </g>
      </>
    ),

  settings: (id) =>
    cut(
      id,
      <>
        <g fill="#fff">
          <circle cx="32" cy="32" r="17.5" />
          {around(8, () => (
            <rect x="28" y="10" width="8" height="12" rx="3" />
          ))}
        </g>
        <circle cx="32" cy="32" r="6.4" fill="#000" />
      </>
    ),
};

/* shapes: no tile behind them */
const SHAPES = {
  folder: (id) => (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4aa6ea" />
          <stop offset="1" stopColor="#2b85d8" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3ff" />
          <stop offset="1" stopColor="#57b2f2" />
        </linearGradient>
      </defs>
      <path
        d="M5 17.5a5 5 0 0 1 5-5h12.9a5 5 0 0 1 3.4 1.33l3.6 3.34a5 5 0 0 0 3.4 1.33H54a5 5 0 0 1 5 5V48a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"
        fill={`url(#${id}a)`}
      />
      <path d="M5 26h54v22a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" fill={`url(#${id}b)`} />
      <path d="M5 26h54v1.6H5z" fill="#fff" opacity=".55" />
    </>
  ),
  txt: () => (
    <>
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="#fff" />
      <path
        d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z"
        fill="none"
        stroke="#c4c4cc"
        strokeWidth="1.5"
      />
      <path d="M38 5v12h12z" fill="#dcdce3" />
      <g fill="#a0a0aa">
        <rect x="18" y="28" width="28" height="3" rx="1.5" />
        <rect x="18" y="36" width="28" height="3" rx="1.5" />
        <rect x="18" y="44" width="18" height="3" rx="1.5" />
      </g>
    </>
  ),
  image: () => (
    <>
      <path d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="#fff" />
      <path
        d="M15 5h23l12 12v41a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z"
        fill="none"
        stroke="#c4c4cc"
        strokeWidth="1.5"
      />
      <path d="M38 5v12h12z" fill="#dcdce3" />
      <path d="M18 28a2 2 0 0 1 2-2h24a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2z" fill="#9cd8ff" />
      <circle cx="39" cy="34" r="3.4" fill="#ffd45e" />
      <path d="M18 50V44l8-9 7.5 9.5L38 40l8 8.6V50z" fill="#3ea15c" />
    </>
  ),
  trash: (id, full) => (
    <>
      {full && (
        <path
          d="M14 14 15.8 7.2 22 9.2 25 2.6 31.5 7 35.5 1.8 39.5 7.6 45.8 5.4 46 11 48 14Z"
          fill="#f2f2f5"
          stroke="#c4c4cc"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      )}
      <rect x="9.5" y="9.5" width="45" height="7.4" rx="3.7" fill="var(--ic-bin-lid, #b9b9c1)" />
      <path
        d="M13.5 18.5h37l-2.7 35a4.4 4.4 0 0 1-4.4 4.1H20.6a4.4 4.4 0 0 1-4.4-4.1z"
        fill="var(--ic-bin, #d2d2d8)"
      />
      <g
        fill="none"
        stroke="var(--ic-bin-line, #9a9aa3)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 26.5 25.2 49M32 26.5V49M40 26.5 38.8 49" />
      </g>
    </>
  ),
};

const AppIcon = ({ icon, alt = "", className }) => {
  // mask ids must be unique, and one icon can be on screen several times
  const id = `ic${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (!icon) return null;
  if (icon.includes("/")) return <img src={icon} alt={alt} className={className} />;

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
