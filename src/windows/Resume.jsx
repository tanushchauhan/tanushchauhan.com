import { Download } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const Resume = () => {
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
        <Document file="/files/resume.pdf">
          <Page
            pageNumber={1}
            width={600}
            renderTextLayer
            renderAnnotationLayer
          />
        </Document>
      </div>
    </>
  );
};

const ResumeWindow = WindowWrapper(Resume, "resume");

export default ResumeWindow;
