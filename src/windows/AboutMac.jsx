import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { locations } from "#constants";
import useWindowStore from "#store/window.js";

const SPECS = [
  ["Chip", "Perception M1 Pro"],
  ["Memory", "3.86 GPA / 4.0 unified"],
  ["Startup Disk", "Dean's Scholars HD"],
  ["Graphics", "LiDAR + RGB Fusion"],
  ["Serial Number", "TC-ATX-CS29"],
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
        <p className="version">Version 1.0 (Zilker)</p>

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
          ™ and © 2026 Tanush Chauhan. Built in Austin.
        </p>
      </div>
    </>
  );
};

const AboutWindow = WindowWrapper(AboutMac, "about");

export default AboutWindow;
