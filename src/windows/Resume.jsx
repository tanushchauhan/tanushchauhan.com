import { lazy, Suspense, useEffect, useState } from "react";
import { Download } from "lucide-react";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useWindowStore from "#store/window.js";

const PdfView = lazy(() => import("./PdfView.jsx"));

const Resume = () => {
  const isOpen = useWindowStore((state) => state.windows.resume.isOpen);

  // WindowWrapper renders every window up front and hides them with CSS, so
  // mounting the viewer must be gated on the window actually having been
  // opened. Without this the lazy import would resolve on first paint anyway.
  const [everOpened, setEverOpened] = useState(isOpen);
  useEffect(() => {
    if (isOpen) setEverOpened(true);
  }, [isOpen]);

  return (
    <>
      <div id="window-header">
        <WindowControls target="resume" />
        <h2>resume.pdf</h2>
        <a
          href="/files/resume.pdf"
          download="Tanush_Chauhan_Resume.pdf"
          className="ml-auto cursor-pointer"
          title="Download résumé"
        >
          <Download className="icon" />
        </a>
      </div>

      <div className="pdf-scroll">
        {everOpened && (
          <Suspense fallback={<p className="pdf-status">Loading résumé…</p>}>
            <PdfView width={600} textLayer />
          </Suspense>
        )}
      </div>
    </>
  );
};

const ResumeWindow = WindowWrapper(Resume, "resume");

export default ResumeWindow;
