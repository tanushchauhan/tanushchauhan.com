/**
 * The words on the research page. Everything else on it is generated from the
 * project and paper data the desktop already uses.
 */

export const OPENING = {
  role: "Undergraduate researcher, Autonomous Mobile Robotics Lab · CS Honors and Math, UT Austin",
  paragraphs: [
    "I am a CS Honors + Math double major at UT Austin (Dean's Scholars), minoring in Robotics. I build things that have to work in the physical world.",
    "Right now I am an undergraduate researcher at the Autonomous Mobile Robotics Lab, tracking people in 3D across six synchronized cameras with ROS2 and NVIDIA DeepStream.",
    "On campus I build with Texas Convergent and work on Longhorn Racing, and I used to coordinate the Agentic AI DiRP.",
  ],
};

/** Which projects belong here, and in what order. */
export const BUILDS = [
  { id: "eye-tracker" },
  { id: "grademate" },
  { id: "systems" },
  { id: "crave" },
];

export const NEWS = [
  { date: "2026-11", label: "Nov 2026", text: "STARS appears at CoRL 2026, in Austin." },
  { date: "2026", label: "2026", text: "STARS accepted at CoRL 2026." },
  { date: "2026", label: "2026", text: "Crave won Hook 'Em Hacks 2026." },
  { date: "2025-07", label: "Jul 2025", text: "MemeQA published at ACL 2025." },
];

export const TEACHING = [
  { when: "2025", text: "Coordinator, Agentic AI Directed Reading Program." },
];
