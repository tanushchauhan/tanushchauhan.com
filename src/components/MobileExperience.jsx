import { lazy, Suspense, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Wifi,
  Signal,
  BatteryFull,
  ChevronLeft,
  Download,
  MoveRight,
  Settings as SettingsIcon,
  Sun,
  Moon,
  MonitorCog,
  Check,
  Mail,
} from "lucide-react";
import clsx from "clsx";
import { locations, highlights, gallery, techStack, socials } from "#constants";
import { TerminalBody } from "#windows/Terminal.jsx";
import { GuestbookBody } from "#windows/Guestbook.jsx";
import { MobileWidgets, MobileSystem } from "./widgets/Widgets.jsx";
import useWindowStore from "#store/window.js";
import useAuthStore from "#store/auth.js";

// same lazy module as the desktop Resume window: the PDF worker is only
// fetched once someone actually opens the résumé. Nothing may be imported
// from it statically, or it lands back in the main chunk.
const PdfView = lazy(() => import("#windows/PdfView.jsx"));

/* ---------------- app registry ---------------- */
const APPS = [
  { id: "projects", name: "Projects", icon: "/images/finder.png" },
  { id: "highlights", name: "Highlights", icon: "/images/safari.png" },
  { id: "gallery", name: "Gallery", icon: "/images/photos.png" },
  { id: "terminal", name: "Terminal", icon: "/images/terminal.png" },
  { id: "contact", name: "Contact", icon: "/images/contact.png" },
  { id: "guestbook", name: "Guestbook", icon: "/images/guestbook.svg" },
  { id: "resume", name: "Résumé", icon: "/images/pdf.png" },
  { id: "about", name: "About Me", icon: "/images/avatar-tanush.svg" },
  { id: "settings", name: "Settings", icon: null },
];

const DOCK_APPS = ["projects", "terminal", "contact", "resume"];

const StatusBar = () => {
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const tick = setInterval(() => setNow(dayjs()), 30_000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="status-bar">
      <span className="time">{now.format("h:mm")}</span>
      <span className="tray">
        <Signal className="size-3.5" />
        <Wifi className="size-3.5" />
        <BatteryFull className="size-4" />
      </span>
    </div>
  );
};

/* ---------------- individual apps ---------------- */

const ProjectsApp = () => {
  // simple drill-down: list of locations -> folder contents -> file sheets
  const [stack, setStack] = useState([]); // array of folder objects
  const [file, setFile] = useState(null); // txt/img being previewed
  const current = stack[stack.length - 1];

  const openItem = (item) => {
    if (item.kind === "folder") return setStack((s) => [...s, item]);
    if (["fig", "url"].includes(item.fileType) && item.href)
      return window.open(item.href, "_blank", "noopener,noreferrer");
    if (item.fileType === "pdf") return window.open("/files/resume.pdf", "_blank");
    setFile(item);
  };

  if (file) {
    const data = file.data;
    return (
      <div className="m-scroll">
        <button type="button" className="m-back" onClick={() => setFile(null)}>
          <ChevronLeft className="size-4" /> Back
        </button>
        <div className="m-txt">
          {data.subtitle && <p className="subtitle">{data.subtitle}</p>}
          {file.fileType === "img" ? (
            <img src={data.imageUrl} alt={data.name} />
          ) : (
            <>
              {data.image && <img src={data.image} alt={data.name} />}
              {data.description?.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  const items = current ? current.children : Object.values(locations);

  return (
    <div className="m-scroll">
      {current && (
        <button
          type="button"
          className="m-back"
          onClick={() => setStack((s) => s.slice(0, -1))}
        >
          <ChevronLeft className="size-4" /> Back
        </button>
      )}
      <ul className="m-list">
        {items.map((item) => (
          <li key={item.id} onClick={() => openItem(item)}>
            <img
              src={item.icon}
              alt={item.name}
              className={clsx(item.kind === "link" && "link-chip")}
            />
            <div>
              <p className="title">{item.name}</p>
              <p className="sub">
                {item.kind === "folder"
                  ? `${item.children?.length ?? 0} items`
                  : item.fileType}
              </p>
            </div>
            {item.kind === "folder" && <ChevronLeft className="chev" />}
          </li>
        ))}
      </ul>
    </div>
  );
};

const HighlightsApp = () => (
  <div className="m-scroll p-4">
    <div className="space-y-4">
      {highlights.map(({ id, tag, title, description, image, link, cta }) => (
        <div key={id} className="m-card">
          <img src={image} alt={title} />
          <div className="body">
            <p className="tag">{tag}</p>
            <h3>{title}</h3>
            <p className="desc">{description}</p>
            <a href={link} target="_blank" rel="noopener noreferrer">
              {cta} <MoveRight className="size-4" />
            </a>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const GalleryApp = () => {
  const [photo, setPhoto] = useState(null);

  if (photo)
    return (
      <div className="m-scroll p-4" onClick={() => setPhoto(null)}>
        <button type="button" className="m-back">
          <ChevronLeft className="size-4" /> Back
        </button>
        <img src={photo.image} alt={photo.name} className="w-full rounded-2xl" />
      </div>
    );

  return (
    <div className="m-scroll p-4">
      <div className="grid grid-cols-2 gap-3">
        {gallery.map((g) => (
          <button
            key={g.id}
            type="button"
            className="overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10"
            onClick={() => setPhoto(g)}
          >
            <img
              src={g.image}
              alt={g.name}
              className={clsx(
                "aspect-square w-full object-cover",
                g.focus === "top" && "object-top"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

const ContactApp = () => (
  <div className="m-scroll p-6 text-center">
    <img
      src="/images/avatar-tanush.svg"
      alt="Tanush Chauhan"
      className="mx-auto w-24 rounded-full"
    />
    <h3 className="mt-4 text-xl font-bold">Let's connect</h3>
    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
      Got a robot to build, an idea to ship, or just want to talk tech? I'm in.
      Based in Austin, TX.
    </p>
    <div className="mt-5 space-y-3">
      {socials.map(({ id, text, icon, link, bg }) => (
        <a
          key={id}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="m-social"
          style={{ backgroundColor: bg }}
        >
          <img src={icon} alt={text} className="size-5" />
          {text}
        </a>
      ))}
      <a href="mailto:tanush@utexas.edu" className="m-social bg-burnt">
        <Mail className="size-5" /> tanush@utexas.edu
      </a>
    </div>
  </div>
);

const ResumeApp = () => (
  <div className="m-scroll bg-neutral-200 p-3 dark:bg-neutral-900">
    <a href="/files/resume.pdf" download="Tanush_Chauhan_Resume.pdf" className="m-download">
      <Download className="size-4" /> Download PDF
    </a>
    <div className="mt-3 overflow-hidden rounded-lg shadow-lg">
      <Suspense fallback={<p className="pdf-status">Loading résumé…</p>}>
        <PdfView width={Math.min(window.innerWidth - 24, 560)} />
      </Suspense>
    </div>
  </div>
);

const AboutApp = () => {
  const about = locations.about.children.find((c) => c.id === "about-me").data;
  const facts = locations.about.children.find((c) => c.id === "fun-facts").data;
  return (
    <div className="m-scroll p-5">
      <div className="m-txt">
        <img src={about.image} alt="Tanush Chauhan" className="m-avatar mb-4" />
        <p className="subtitle">{about.subtitle}</p>
        {about.description.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="subtitle mt-6">{facts.subtitle}</p>
        {facts.description.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="subtitle mt-6">Tech stack</p>
        {techStack.map(({ category, items }) => (
          <p key={category}>
            <strong>{category}:</strong> {items.join(", ")}
          </p>
        ))}
      </div>
    </div>
  );
};

const SettingsApp = () => {
  const { theme, setTheme } = useWindowStore();
  const options = [
    { value: "auto", label: "Auto", icon: MonitorCog, note: "Match this device" },
    { value: "light", label: "Light", icon: Sun, note: "Austin at golden hour" },
    { value: "dark", label: "Dark", icon: Moon, note: "Austin after dark" },
  ];
  return (
    <div className="m-scroll p-4">
      <p className="m-section-label">Appearance</p>
      <ul className="m-settings">
        {options.map(({ value, label, icon: Icon, note }) => (
          <li key={value} onClick={() => setTheme(value)}>
            <Icon className="size-5" />
            <div>
              <p className="title">{label}</p>
              <p className="sub">{note}</p>
            </div>
            {theme === value && <Check className="ml-auto size-5 text-burnt" />}
          </li>
        ))}
      </ul>
    </div>
  );
};

const APP_SCREENS = {
  projects: ProjectsApp,
  highlights: HighlightsApp,
  gallery: GalleryApp,
  terminal: TerminalBody,
  contact: ContactApp,
  guestbook: GuestbookBody,
  resume: ResumeApp,
  about: AboutApp,
  settings: SettingsApp,
};

/* ---------------- springboard ---------------- */

const AppIcon = ({ app, onOpen }) => (
  <button type="button" className="m-app" onClick={() => onOpen(app.id)}>
    {app.icon ? (
      <img src={app.icon} alt={app.name} />
    ) : (
      <span className="settings-tile">
        <SettingsIcon className="size-8 text-white" />
      </span>
    )}
    <p>{app.name}</p>
  </button>
);

const MobileExperience = () => {
  const [activeApp, setActiveApp] = useState(null);
  const app = APPS.find((a) => a.id === activeApp);
  const pagesRef = useRef(null);
  const [page, setPage] = useState(0);
  const authed = useAuthStore((s) => s.status === "authed");
  const pageCount = authed ? 3 : 2;

  // derive the active page from scroll position rather than tracking gestures:
  // works for swipes, dot taps, and keyboard scrolling alike
  const onPageScroll = (e) => {
    const el = e.currentTarget;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== page) setPage(next);
  };

  const goToPage = (i) => {
    const el = pagesRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const Screen = activeApp ? APP_SCREENS[activeApp] : null;

  return (
    <div id="mobile">
      <StatusBar />

      <div className="springboard">
        <div className="m-pages" ref={pagesRef} onScroll={onPageScroll}>
          <section className="m-page">
            <div className="m-widget">
              <p className="hello">Hey, I'm Tanush</p>
              <h1>tanushchauhan.com</h1>
              <p className="tagline">
                CS Honors + Math @ UT Austin · robotics researcher · hackathon regular
              </p>
            </div>

            <MobileWidgets />
          </section>

          <section className="m-page">
            <div className="m-grid">
              {APPS.filter((a) => !DOCK_APPS.includes(a.id)).map((a) => (
                <AppIcon key={a.id} app={a} onOpen={setActiveApp} />
              ))}
            </div>
          </section>

          {/* appended, so signing in adds a page rather than renumbering the
              two every visitor already sees */}
          {authed && (
            <section className="m-page">
              <MobileSystem />
            </section>
          )}
        </div>

        {/* the dock and dots sit outside .m-pages so they stay put while the
            pages move, exactly as on iOS */}
        <div className="m-dots">
          {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Page ${i + 1}`}
              className={clsx(i === page && "on")}
              onClick={() => goToPage(i)}
            />
          ))}
        </div>

        <div className="m-dock">
          {APPS.filter((a) => DOCK_APPS.includes(a.id)).map((a) => (
            <AppIcon key={a.id} app={a} onOpen={setActiveApp} />
          ))}
        </div>
      </div>

      {app && (
        <div className={clsx("m-sheet", activeApp === "terminal" && "is-terminal")}>
          <div className="m-sheet-header">
            <h2>{app.name}</h2>
            <button type="button" onClick={() => setActiveApp(null)}>
              Done
            </button>
          </div>
          <Screen />
          <div className="home-indicator" onClick={() => setActiveApp(null)} />
        </div>
      )}
    </div>
  );
};

export default MobileExperience;
