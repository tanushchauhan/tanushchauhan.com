import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { play } from "../utils/sound.js";

const seen = () => sessionStorage.getItem("booted") === "1";

const wantsMotion = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const BootScreen = () => {
  const [done, setDone] = useState(() => seen() || !wantsMotion());
  const rootRef = useRef(null);
  const barRef = useRef(null);
  const timelineRef = useRef(null);

  const finish = useCallback(() => {
    sessionStorage.setItem("booted", "1");
    setDone(true);
  }, []);

  useGSAP(() => {
    if (done) return;

    play("boot"); // silent no-op when sound is off or autoplay-blocked

    timelineRef.current = gsap
      .timeline({ onComplete: finish })
      .fromTo(
        ".boot-logo",
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }
      )
      .to(barRef.current, { width: "100%", duration: 0.55, ease: "power1.inOut" })
      .to(rootRef.current, { opacity: 0, duration: 0.3, ease: "power2.in" }, "+=0.1");
  }, []);

  // a click or a key takes you straight to the desktop
  useEffect(() => {
    if (done) return;

    const skip = () => {
      timelineRef.current?.kill();
      gsap.to(rootRef.current, { opacity: 0, duration: 0.15, onComplete: finish });
    };

    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [done, finish]);

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
