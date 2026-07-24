import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { play } from "../utils/sound.js";

const BootScreen = () => {
  const [done, setDone] = useState(() => sessionStorage.getItem("booted") === "1");
  const rootRef = useRef(null);
  const barRef = useRef(null);

  useGSAP(() => {
    if (done) return;

    play("boot"); // silent no-op when sound is off or autoplay-blocked

    const tl = gsap.timeline({
      onComplete: () => {
        sessionStorage.setItem("booted", "1");
        setDone(true);
      },
    });

    tl.fromTo(
      ".boot-logo",
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }
    )
      .to(barRef.current, { width: "100%", duration: 1.4, ease: "power1.inOut" })
      .to(rootRef.current, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=0.15");
  }, []);

  if (done) return null;

  return (
    <div id="boot" ref={rootRef}>
      <div className="boot-logo flex flex-col items-center gap-3">
        <img src="/images/avatar-tanush.svg" alt="tanushchauhan.com" className="size-20" />
        <p className="logo text-2xl!">tanushchauhan.com</p>
      </div>
      <div className="bar">
        <div ref={barRef} />
      </div>
    </div>
  );
};

export default BootScreen;
