import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// react-pdf and its ~1.4 MB worker live in this module alone so the rest of the
// desktop never pays for them. Both the desktop Resume window and the mobile
// résumé app import it lazily, and only once their view is actually opened.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const PdfLoading = () => <p className="pdf-status">Loading résumé…</p>;

const PdfView = ({ width = 600, textLayer = false }) => (
  <Document file="/files/resume.pdf" loading={<PdfLoading />}>
    <Page
      pageNumber={1}
      width={width}
      renderTextLayer={textLayer}
      renderAnnotationLayer={textLayer}
    />
  </Document>
);

export default PdfView;
