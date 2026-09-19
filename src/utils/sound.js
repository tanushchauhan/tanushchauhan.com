// tiny WebAudio synth, no audio assets, everything is generated
let ctx = null;
let enabled = false;

export const setSoundEnabled = (on) => {
  enabled = on;
};

const getCtx = () => {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

const tone = (ac, { freq, to = freq, at = 0, dur = 0.15, type = "sine", vol = 0.07 }) => {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
};

const RECIPES = {
  // soft two-note pop
  open: (ac) => {
    tone(ac, { freq: 520, to: 760, dur: 0.12 });
    tone(ac, { freq: 1040, at: 0.02, dur: 0.1, vol: 0.04 });
  },
  close: (ac) => tone(ac, { freq: 640, to: 380, dur: 0.13 }),
  minimize: (ac) => tone(ac, { freq: 880, to: 220, dur: 0.3, type: "triangle", vol: 0.06 }),
  restore: (ac) => tone(ac, { freq: 220, to: 880, dur: 0.25, type: "triangle", vol: 0.06 }),
  // F#-major boot chime, a nod to the classic
  boot: (ac) =>
    [185.0, 233.08, 277.18, 369.99].forEach((freq) =>
      tone(ac, { freq, dur: 1.6, vol: 0.05 })
    ),
};

export const play = (name) => {
  if (!enabled) return;
  try {
    const ac = getCtx();
    if (ac.state === "suspended") return;
    RECIPES[name]?.(ac);
  } catch {
  }
};
