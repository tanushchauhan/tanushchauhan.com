import WindowWrapper from "#hoc/WindowWrapper.jsx";
import { WindowControls } from "#components";
import { socials } from "#constants";

const Contact = () => {
  return (
    <>
      <div id="window-header">
        <WindowControls target="contact" />
        <h2>Contact Me</h2>
      </div>

      <div className="body">
        <img
          src="/images/avatar-tanush.svg"
          alt="Tanush Chauhan"
          className="w-20 rounded-full"
        />
        <div>
          <h3>Get in touch</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Austin, TX. Email is the fastest way to reach me, and I answer:
            research, robotics, or something you want built.
          </p>
        </div>

        <ul>
          {socials.map(({ id, bg, link, icon, text }) => (
            <li key={id} style={{ backgroundColor: bg }}>
              <a href={link} target="_blank" rel="noopener noreferrer" title={text}>
                <img src={icon} alt={text} className="size-5" />
                <p>{text}</p>
              </a>
            </li>
          ))}
        </ul>

        <p className="email">
          Or just email me at{" "}
          <a href="mailto:tanush@utexas.edu">tanush@utexas.edu</a>
        </p>
      </div>
    </>
  );
};

const ContactWindow = WindowWrapper(Contact, "contact", { resizable: false });

export default ContactWindow;
