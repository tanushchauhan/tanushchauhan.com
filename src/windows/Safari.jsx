import {
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  ShieldHalf,
  Search,
  Share,
  Plus,
  Copy,
  MoveRight,
} from "lucide-react";
import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { highlights } from "#constants";

const Safari = () => {
  return (
    <>
      <div id="window-header" className="!h-12 gap-4">
        <WindowControls target="safari" />
        <PanelLeft className="icon ml-6" />
        <div className="flex items-center gap-1">
          <ChevronLeft className="icon" />
          <ChevronRight className="icon" />
        </div>
        <div className="flex flex-1 items-center gap-3">
          <ShieldHalf className="icon" />
          <div className="search">
            <Search className="icon" />
            <input type="text" placeholder="tanushchauhan.com/highlights" readOnly />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Share className="icon" />
          <Plus className="icon" />
          <Copy className="icon" />
        </div>
      </div>

      <div className="blog">
        <h2>Highlights</h2>
        <p className="sub">
          The greatest hits: research, wins, and things that shipped.
        </p>
        <div className="space-y-2">
          {highlights.map(({ id, tag, title, description, image, link, cta }) => (
            <div key={id} className="blog-post">
              <img src={image} alt={title} />
              <div className="content">
                <p>{tag}</p>
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
    </>
  );
};

const SafariWindow = WindowWrapper(Safari, "safari");

export default SafariWindow;
