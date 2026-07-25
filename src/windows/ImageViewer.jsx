import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import useWindowStore from "#store/window.js";

const ImageViewer = () => {
  const { windows } = useWindowStore();
  const data = windows.imgFile.data;

  if (!data) return null;

  return (
    <>
      <div id="window-header">
        <WindowControls target="imgFile" />
        <h2>{data.name}</h2>
        <a href={data.imageUrl} target="_blank" rel="noopener noreferrer">
          Open full size ↗
        </a>
      </div>

      <div className="img-body">
        <img src={data.imageUrl} alt={data.name} />
      </div>
    </>
  );
};

const ImageWindow = WindowWrapper(ImageViewer, "imgFile");

export default ImageWindow;
