import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { locations } from "#constants";
import useWindowStore from "#store/window.js";

/*
 * What the machine is, not what its owner has achieved. The spec sheet used to
 * put a GPA in the Memory slot and a scholarship in the Startup Disk, which is
 * a boast wearing a joke's clothes. The panel is more use to the sort of person
 * who opens it if it answers what the thing is built out of, and there is a
 * More Info button for the rest.
 */
const SPECS = [
  ["Chip", "React 19 on Vite"],
  ["Memory", "Hono on Bun, Postgres"],
  ["Startup Disk", "Coolify"],
  ["Graphics", "GSAP"],
  ["Serial Number", "TC-ATX-2026"],
];

const AboutMac = () => {
  const { openWindow } = useWindowStore();

  const openAboutMe = () => {
    const aboutTxt = locations.about.children.find((c) => c.id === "about-me");
    openWindow("txtFile", aboutTxt.data);
  };

  return (
    <>
      <div id="window-header">
        <WindowControls target="about" />
      </div>

      <div className="about-body">
        <img src="/images/avatar-tanush.svg" alt="Tanush Chauhan" />
        <h3>tanushchauhan.com</h3>
        <p className="version">Version 1.0</p>

        <dl>
          {SPECS.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <button type="button" onClick={openAboutMe}>
          More Info…
        </button>

        <p className="fine-print">
          ™ and © 2026 Tanush Chauhan.
        </p>
      </div>
    </>
  );
};

const AboutWindow = WindowWrapper(AboutMac, "about", { resizable: false });

export default AboutWindow;
