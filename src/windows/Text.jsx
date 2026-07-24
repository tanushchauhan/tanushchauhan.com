import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useWindowStore from "#store/window.js";

const Text = () => {
  const { windows } = useWindowStore();
  const data = windows.txtFile.data;

  if (!data) return null;

  const { name, subtitle, image, description = [] } = data;

  return (
    <>
      <div id="window-header">
        <WindowControls target="txtFile" />
        <h2>{name}</h2>
      </div>

      <div className="txt-body">
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {image && <img src={image} alt={name} />}
        {description.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </>
  );
};

const TextWindow = WindowWrapper(Text, "txtFile");

export default TextWindow;
