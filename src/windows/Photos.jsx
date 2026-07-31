import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { gallery } from "#constants";
import useWindowStore from "#store/window.js";

const GROUPS = [...new Set(gallery.map((g) => g.group))];

const Photos = () => {
  const { openWindow } = useWindowStore();

  return (
    <>
      <div id="window-header">
        <WindowControls target="photos" />
        <h2>Gallery</h2>
        <p className="ml-auto text-xs text-neutral-400">{gallery.length} items</p>
      </div>

      <div className="photos-body">
        {GROUPS.map((group) => {
          const items = gallery.filter((g) => g.group === group);
          return (
            <section key={group}>
              <h3>
                {group} <span>· {items.length}</span>
              </h3>
              <div className="gallery">
                {items.map(({ id, name, image, focus }) => (
                  <button
                    key={id}
                    type="button"
                    title={name}
                    onClick={() => openWindow("imgFile", { name, imageUrl: image })}
                  >
                    <img
                      src={image}
                      alt={name}
                      loading="lazy"
                      className={focus === "top" ? "object-top" : undefined}
                    />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
};

const PhotosWindow = WindowWrapper(Photos, "photos", { min: { w: 480, h: 320 } });

export default PhotosWindow;
