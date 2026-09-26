/**
 * App and document icons, drawn in SVG over a CSS tile so the glass setting
 * can restyle them. A path instead of a name renders as a plain <img>.
 */
import { useId } from "react";
import clsx from "clsx";

const round = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };

const around = (n, draw) =>
  Array.from({ length: n }, (_, i) => (
    <g key={i} transform={`rotate(${(i * 360) / n} 32 32)`}>
      {draw(i)}
    </g>
  ));

const tooth = (inner, outer, width) => (
  <rect x={32 - width / 2} y={32 - outer} width={width} height={outer - inner} rx={width / 2} />
);

const GLYPHS = {
  // a stack of sheets: the projects folder, not any one document
  finder: () => (
    <>
      <g fill="var(--ic-glyph, #ffffff)">
        <rect x="12" y="14" width="34" height="26" rx="4" opacity=".45" />
        <rect x="17" y="21" width="34" height="26" rx="4" opacity=".7" />
        <rect x="22" y="28" width="30" height="24" rx="4" />
      </g>
      <g {...round} style={{ stroke: "var(--ic-line, #3b2f8f)" }} strokeWidth="2.2">
        <path d="M28 36h18M28 43h12" />
      </g>
    </>
  ),

  // a bookmark, for the reading list
  safari: () => (
    <>
      <path
        d="M20 10h24a3 3 0 0 1 3 3v40a1.6 1.6 0 0 1-2.5 1.3L32 45.4 19.5 54.3A1.6 1.6 0 0 1 17 53V13a3 3 0 0 1 3-3z"
        fill="var(--ic-glyph, #ffffff)"
      />
      <path d="M26 22h12" {...round} style={{ stroke: "var(--ic-line, #0d5b6b)" }} strokeWidth="2.6" />
    </>
  ),

  // an aperture, for the gallery
  photos: () => (
    <>
      <circle cx="32" cy="32" r="21" fill="none" stroke="var(--ic-glyph, #ffffff)" strokeWidth="3.4" />
      <g style={{ stroke: "var(--ic-glyph, #ffffff)" }} strokeWidth="3" strokeLinecap="round">
        {around(6, () => (
          <path d="M32 13.2 43 32" />
        ))}
      </g>
      <circle cx="32" cy="32" r="4.6" fill="var(--ic-glyph, #ffffff)" />
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
      <rect
        x="8"
        y="14"
        width="48"
        height="36"
        rx="5"
        fill="var(--ic-glyph, #ffffff)"
      />
      <g style={{ fill: "var(--ic-line, #39414b)" }}>
        <circle cx="24" cy="28.5" r="6.2" />
        <path d="M14.5 43.4c1.4-5.2 17.6-5.2 19 0 .3 1.7-3.9 2.9-9.5 2.9s-9.8-1.2-9.5-2.9z" />
      </g>
      <g {...round} style={{ stroke: "var(--ic-line, #39414b)" }} strokeWidth="2.4" opacity=".55">
        <path d="M39 27h11M39 34h11M39 41h7" />
      </g>
    </>
  ),

  guestbook: () => (
    <>
      <path
        d="M14 12h36a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H31.5L18 58.2A1.4 1.4 0 0 1 15.8 57l.2-9H14a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8z"
        fill="var(--ic-glyph, #ffffff)"
      />
      <g {...round} style={{ stroke: "var(--ic-line, #8e2f53)" }} strokeWidth="3">
        <path d="M17 24h30M17 33h22" />
      </g>
    </>
  ),

  settings: () => (
    <>
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
  trash: (id, full) => (
    <>
      {full && (
        <g fill="#f4f4f6" stroke="#c6c6cd" strokeWidth=".6" strokeLinejoin="round">
          <path d="M16.5 12c-.8-3.2 1.2-6.4 4.6-6.9 2.2-2.3 6.1-1.9 7.6.8 2.6-.3 4.6 1.6 4.6 4.1l.3 2z" />
          <path d="M32 12c-.4-3.8 1.6-7.4 5.2-8.2 2.7-.6 5 .7 5.9 2.8 2.8-.1 5 2.2 4.8 4.8l-.1 .6z" />
        </g>
      )}
      <rect x="9.5" y="9.5" width="45" height="7.4" rx="3.7" fill="var(--ic-bin-lid, #b9b9c1)" />
      <path
        d="M13.5 18.5h37l-2.7 35a4.4 4.4 0 0 1-4.4 4.1H20.6a4.4 4.4 0 0 1-4.4-4.1z"
        fill="var(--ic-bin, #d2d2d8)"
      />
      <g {...round} style={{ stroke: "var(--ic-bin-line, #9a9aa3)" }} strokeWidth="2.2">
        <path d="M24 26.5 25.2 49M32 26.5V49M40 26.5 38.8 49" />
      </g>
    </>
  ),
};

const AppIcon = ({ icon, alt = "", className }) => {
  // gradient ids must be unique, and one icon can be on screen several times
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
