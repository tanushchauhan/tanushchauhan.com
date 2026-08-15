import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useWindowStore from "#store/window.js";

const Text = () => {
  const { windows } = useWindowStore();
  const data = windows.txtFile.data;

  if (!data) return null;

  const { name, subtitle, image, portrait, description = [] } = data;

  return (
    <>
      <div id="window-header">
        <WindowControls target="txtFile" />
        <h2>{name}</h2>
      </div>

      <div className="txt-body">
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {/* Only the about-me photo is a face, and only a face survives being
            cropped to a circle. The project images are 16:9 logos and product
            shots, so the same treatment cut the GradeMate wordmark in half. */}
        {image && (
          <img src={image} alt={name} className={portrait ? "portrait" : "banner"} />
        )}
        {description.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </>
  );
};

const TextWindow = WindowWrapper(Text, "txtFile");

export default TextWindow;
