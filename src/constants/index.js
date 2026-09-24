export const navLinks = [
  { id: 1, name: "Projects", type: "finder" },
  { id: 2, name: "Papers", type: "publications" },
  { id: 3, name: "Contact", type: "contact" },
];

export const navIcons = [
  { id: 1, img: "/icons/wifi.svg" },
  { id: 2, img: "/icons/search.svg" },
];

/** Each wallpaper is a light and dark pair. */
export const wallpapers = [
  {
    id: "austin",
    name: "Austin",
    note: "Hill country, golden hour and after dark",
    light: "/images/wallpaper-austin.svg",
    dark: "/images/wallpaper-austin-night.svg",
  },
  {
    id: "bluebonnet",
    name: "Bluebonnet",
    note: "The same hills, in April",
    light: "/images/wallpaper-bluebonnet.svg",
    dark: "/images/wallpaper-bluebonnet-night.svg",
  },
  {
    id: "graphite",
    name: "Graphite",
    note: "No scenery, for when the windows are the subject",
    light: "/images/wallpaper-graphite.svg",
    dark: "/images/wallpaper-graphite-night.svg",
    // pale at the top, so the menu bar uses dark ink
    paleSky: true,
  },
];

export const DEFAULT_WALLPAPER = "graphite";

const wallpaperById = (id) => wallpapers.find((w) => w.id === id) ?? wallpapers[0];

export const wallpaperFor = (id, dark) => {
  const paper = wallpaperById(id);
  return dark ? paper.dark : paper.light;
};

export const paleSky = (id, dark) => !dark && Boolean(wallpaperById(id).paleSky);

export const dockApps = [
  { id: "finder", name: "Projects", icon: "finder", canOpen: true },
  { id: "safari", name: "Highlights", icon: "safari", canOpen: true },
  { id: "photos", name: "Gallery", icon: "photos", canOpen: true },
  { id: "terminal", name: "Terminal", icon: "terminal", canOpen: true },
  { id: "contact", name: "Contact", icon: "contact", canOpen: true },
  { id: "guestbook", name: "Guestbook", icon: "guestbook", canOpen: true },
  { id: "trash", name: "Trash", icon: "trash", canOpen: true },
];

export const techStack = [
  {
    category: "Languages",
    items: [
      "TypeScript",
      "JavaScript",
      "Python",
      "C/C++",
      "Java",
      "Swift",
      "SQL",
      "Verilog",
    ],
  },
  {
    category: "Web",
    items: ["React", "Next.js", "Tailwind CSS", "FastAPI", "Node.js"],
  },
  {
    category: "Mobile",
    items: ["React Native", "SwiftUI", "Flutter"],
  },
  {
    category: "AI / ML",
    items: ["PyTorch", "OpenCV", "AWS Bedrock", "pgvector", "Optuna"],
  },
  {
    category: "Robotics",
    items: ["ROS2", "NVIDIA DeepStream", "Docker", "ESP32"],
  },
  {
    category: "Cloud & Data",
    items: ["Supabase (PostgreSQL)", "AWS Lambda", "Oracle Cloud", "Linux", "Git"],
  },
];

export const highlights = [
  {
    id: 1,
    tag: "Publication",
    title:
      "STARS: From Spatiotemporal Dynamics to Social Representations in Human-Robot Interaction · CoRL 2026",
    description:
      "A study of how robots can read social context from motion. I built the control baselines the learned representations were measured against, across 260 Optuna trials and 10-seed sweeps.",
    image: "/images/posters/poster-corl.svg",
    link: "https://www.corl.org/",
    cta: "CoRL 2026, in Austin this November",
  },
  {
    id: 2,
    tag: "Publication",
    title: "MemeQA: Holistic Evaluation for Meme Understanding · ACL 2025",
    description:
      "Co-authored a 9,000+ question benchmark for meme comprehension with Prof. Vincent Ng's group at UT Dallas, published at the 63rd Annual Meeting of the ACL.",
    image: "/images/posters/poster-acl.svg",
    link: "https://aclanthology.org/2025.acl-long.927/",
    cta: "Read the paper",
  },
  {
    id: 3,
    tag: "Research",
    title: "Autonomous Mobile Robotics Lab @ UT Austin",
    description:
      "Tracking people in 3D across six hardware-synchronized cameras, with Dockerized ROS2 and NVIDIA DeepStream holding 60 FPS and 22 simultaneous tracks on a single GPU.",
    image: "/images/posters/poster-robot.svg",
    link: "https://www.linkedin.com/in/tanushchauhan",
    cta: "More on LinkedIn",
  },
  {
    id: 4,
    tag: "Hackathon Win",
    title: "Crave · Best Use of Supabase & Most Startup Ready",
    description:
      "An AI dining concierge with a voice agent, group-preference reconciliation via pgvector, and receipt-OCR bill splitting. Hook 'Em Hacks 2026 @ UT Austin.",
    image: "/images/projects/crave.jpg",
    link: "https://devpost.com/software/crave-onrtlb",
    cta: "See it on Devpost",
  },
  {
    id: 5,
    tag: "Shipped",
    title: "GradeMate · 1,180+ installs on the App Store",
    description:
      "A cross-platform grade tracker and GPA predictor, live on the App Store and running on Oracle Cloud.",
    image: "/images/projects/grademate.jpg",
    link: "https://apps.apple.com/us/app/grademate-for-hac/id6705125322",
    cta: "Get it on the App Store",
  },
];

export const socials = [
  {
    id: 1,
    text: "GitHub",
    icon: "/icons/github.svg",
    link: "https://github.com/tanushchauhan",
    bg: "#24292f",
  },
  {
    id: 2,
    text: "LinkedIn",
    icon: "/icons/linkedin.svg",
    link: "https://www.linkedin.com/in/tanushchauhan",
    bg: "#0a66c2",
  },
];

export const gallery = [
  {
    id: 1,
    name: "crave.jpg",
    group: "Projects",
    image: "/images/projects/crave.jpg",
  },
  {
    id: 2,
    name: "shoo.jpg",
    group: "Projects",
    image: "/images/projects/shoo.jpg",
  },
  {
    id: 3,
    name: "kindred.jpg",
    group: "Projects",
    image: "/images/projects/kindred.jpg",
  },
  {
    id: 4,
    name: "prism.jpg",
    group: "Projects",
    image: "/images/projects/prism.jpg",
  },
  {
    id: 5,
    name: "grademate.jpg",
    group: "Projects",
    image: "/images/projects/grademate.jpg",
  },
  {
    id: 6,
    name: "memeqa-acl2025.png",
    group: "Research & Awards",
    image: "/images/posters/poster-acl.svg",
  },
  {
    id: 7,
    name: "amrl-research.png",
    group: "Research & Awards",
    image: "/images/posters/poster-robot.svg",
  },
  {
    id: 8,
    name: "eye-tracker.png",
    group: "Research & Awards",
    image: "/images/posters/poster-eye.svg",
  },
  {
    id: 11,
    name: "stars-corl2026.png",
    group: "Research & Awards",
    image: "/images/posters/poster-corl.svg",
  },
  {
    id: 12,
    name: "gates-to-threads.png",
    group: "Projects",
    image: "/images/posters/poster-systems.svg",
  },
  // `focus: "top"` crops the thumbnail from the top instead of the centre
  {
    id: 9,
    name: "me.png",
    group: "Off the Clock",
    image: "/images/me.jpg",
    focus: "top",
  },
  {
    id: 10,
    name: "get-to-know-me.png",
    group: "Off the Clock",
    image: "/images/poster-tanush.jpg",
    focus: "top",
  },
];

const project = (id, name, windowPosition, position, about, links = []) => ({
  id,
  type: id,
  name,
  icon: "folder",
  kind: "folder",
  windowPosition,
  position,
  children: [
    {
      id: `${id}-about`,
      name: "about.txt",
      icon: "txt",
      kind: "file",
      fileType: "txt",
      position: "top-4 left-4",
      data: about,
    },
    ...links,
  ],
});

export const locations = {
  work: {
    id: "work",
    type: "work",
    name: "Projects",
    icon: "/icons/work.svg",
    kind: "folder",
    children: [
      project(
        "crave",
        "Crave",
        "top-[6vh] right-[2vw]",
        "top-4 left-4",
        {
          name: "Crave · about.txt",
          subtitle: "AI dining concierge · Hook 'Em Hacks 2026 winner",
          image: "/images/projects/crave.jpg",
          description: [
            "Crave is an AI dining concierge. A voice agent (ElevenLabs) calls custom Supabase Edge Function tools to query the database and reconcile group food preferences using Titan embeddings + pgvector HNSW search.",
            "It also does receipt-OCR bill splitting and ships a B2B analytics chatbot for restaurants.",
            "Won Best Use of Supabase and Most Startup Ready at Hook 'Em Hacks 2026, UT Austin.",
            "Stack: React Native · Next.js 16 · AWS Bedrock · Supabase + pgvector · AWS Lambda · ElevenLabs",
          ],
        },
        [
          {
            id: "crave-gh",
            name: "devpost.com",
            icon: "/icons/file.svg",
            kind: "link",
            fileType: "url",
            href: "https://devpost.com/software/crave-onrtlb",
            position: "top-4 left-32",
          },
          {
            id: "crave-img",
            name: "preview.jpg",
            icon: "image",
            kind: "file",
            fileType: "img",
            position: "top-4 left-60",
            data: {
              name: "crave · preview.jpg",
              imageUrl: "/images/projects/crave.jpg",
            },
          },
        ],
      ),
      project(
        "shoo",
        "Shoo!",
        "top-[24vh] right-[2vw]",
        "top-4 left-32",
        {
          name: "Shoo! · about.txt",
          subtitle: "Edge-AI wildlife deterrent · Texas Convergent IoT Case",
          image: "/images/projects/shoo.jpg",
          description: [
            "Shoo! is an edge-AI wildlife deterrent. Ultrasonic + GPS-triggered ESP32-CAM captures stream to an on-prem Python server running Qwen2.5-VL locally for species identification, then sync to a community mobile app via Supabase Realtime.",
            "Best Presentation, Texas Convergent IoT Case, Spring 2026.",
            "Stack: ESP32-CAM · C++ · Python · Qwen2.5-VL / Ollama · Supabase (Realtime/RLS/Storage) · React Native",
          ],
        },
        [
          {
            id: "shoo-gh",
            name: "github.com",
            icon: "/icons/github.svg",
            kind: "link",
            fileType: "url",
            href: "https://github.com/tanushchauhan/Shoo",
            position: "top-4 left-32",
          },
          {
            id: "shoo-img",
            name: "preview.jpg",
            icon: "image",
            kind: "file",
            fileType: "img",
            position: "top-4 left-60",
            data: {
              name: "shoo · preview.jpg",
              imageUrl: "/images/projects/shoo.jpg",
            },
          },
        ],
      ),
      project(
        "kindred",
        "Kindred",
        "top-[42vh] right-[2vw]",
        "top-4 left-60",
        {
          name: "Kindred · about.txt",
          subtitle: "AI marketplace · Texas Convergent Health Tech Case",
          image: "/images/projects/kindred.jpg",
          description: [
            "Kindred is an AI-driven marketplace that matches trainers and nutritionists with clients. A matching pipeline uses Supabase vector search and Llama 3.1 (through NVIDIA NIM) to analyze user profiles and automate personalized matches.",
            "Best Presentation, Texas Convergent Health Tech Case, Fall 2025.",
            "Stack: Next.js 16 · React Native · Supabase · NVIDIA AI",
          ],
        },
        [
          {
            id: "kindred-gh",
            name: "github.com",
            icon: "/icons/github.svg",
            kind: "link",
            fileType: "url",
            href: "https://github.com/tanushchauhan/kindred",
            position: "top-4 left-32",
          },
        ],
      ),
      project(
        "prism",
        "Prism",
        "top-[6vh] right-[10vw]",
        "top-40 left-4",
        {
          name: "Prism · about.txt",
          subtitle: "Multi-agent product strategy platform",
          image: "/images/projects/prism.jpg",
          description: [
            "Prism is an AI-driven, multi-agent product strategy platform. FastAPI orchestrates parallel NVIDIA Nemotron LLM workflows, and React Flow + Jira/Auth0 integrations convert AI outputs into authenticated epics and tickets.",
            "Stack: React 18 · FastAPI · React Flow · NVIDIA Nemotron · Auth0 · Jira",
          ],
        },
        [
          {
            id: "prism-devpost",
            name: "devpost.com",
            icon: "/icons/file.svg",
            kind: "link",
            fileType: "url",
            href: "https://devpost.com/software/prism-l2nb54",
            position: "top-4 left-32",
          },
          {
            id: "prism-gh",
            name: "github.com",
            icon: "/icons/github.svg",
            kind: "link",
            fileType: "url",
            href: "https://github.com/tanushchauhan/Prism",
            position: "top-4 left-60",
          },
        ],
      ),
      project(
        "grademate",
        "GradeMate",
        "top-[24vh] right-[10vw]",
        "top-40 left-32",
        {
          name: "GradeMate · about.txt",
          subtitle: "1,180+ installs · live on the App Store",
          image: "/images/projects/grademate.jpg",
          description: [
            "GradeMate is a cross-platform grade tracker and GPA predictor with 1,180+ installs, built for students stuck with Home Access Center.",
            "Built with Next.js and Flutter, deployed on Oracle Cloud, and shipped to the App Store.",
            "Stack: Next.js · React.js · Tailwind · Flutter · Oracle Cloud",
          ],
        },
        [
          {
            id: "grademate-gh",
            name: "github.com",
            icon: "/icons/github.svg",
            kind: "link",
            fileType: "url",
            href: "https://github.com/tanushchauhan/GradeMate",
            position: "top-4 left-32",
          },
          {
            id: "grademate-app",
            name: "apps.apple.com",
            icon: "/icons/file.svg",
            kind: "link",
            fileType: "url",
            href: "https://apps.apple.com/us/app/grademate-for-hac/id6705125322",
            position: "top-4 left-60",
          },
        ],
      ),
      project(
        "eye-tracker",
        "Eye Tracker",
        "top-[42vh] right-[10vw]",
        "top-40 left-60",
        {
          name: "Eye Tracker · about.txt",
          subtitle: "3D gaze control · Best Overall, ECLAIR Robotics",
          image: "/images/posters/poster-eye.svg",
          description: [
            "A dual-camera eye tracker built in Python and OpenCV. Adaptive thresholding, contour filtering, and ellipse fitting find the pupil, vectorized down to 2.45 ms per frame on a single-eye benchmark clip.",
            "Per-eye calibration turns pupil offsets into metric gaze rays, and the two eyes are triangulated into room coordinates with a confidence score based on how close the rays come to meeting.",
            "The fused gaze yaw drives an ESP32 and PCA9685 servo controller over serial, with three-point calibration, EMA smoothing, and send-rate limiting to keep the motion steady.",
            "Best Overall Project, ECLAIR Robotics, Spring 2026.",
            "Stack: Python · OpenCV · ESP32 · PCA9685",
          ],
        },
        [
          {
            id: "eye-tracker-img",
            name: "poster.png",
            icon: "image",
            kind: "file",
            fileType: "img",
            position: "top-4 left-32",
            data: {
              name: "eye tracker · poster.png",
              imageUrl: "/images/posters/poster-eye.svg",
            },
          },
        ],
      ),
      project(
        "systems",
        "Gates to Threads",
        "top-[6vh] right-[18vw]",
        "top-76 left-4",
        {
          name: "Gates to Threads · about.txt",
          subtitle: "A processor, a compiler, and an emulator · CS 429H",
          image: "/images/posters/poster-systems.svg",
          description: [
            "Three projects for CS 429H, the honors architecture course, that go from gates up to threads.",
            "A pipelined 16-bit processor in Verilog, with forwarding and hazard detection so instructions keep issuing through dependencies.",
            "An optimizing x86-64 compiler in C++ for a statically typed subset of Python.",
            "A multithreaded AArch64 emulator using lock-free synchronization across four OS threads.",
            "Stack: Verilog · C · C++ · x86-64 and AArch64 assembly",
          ],
        },
        [
          {
            id: "systems-img",
            name: "poster.png",
            icon: "image",
            kind: "file",
            fileType: "img",
            position: "top-4 left-32",
            data: {
              name: "gates to threads · poster.png",
              imageUrl: "/images/posters/poster-systems.svg",
            },
          },
        ],
      ),
    ],
  },
  publications: {
    id: "publications",
    type: "publications",
    name: "Publications",
    icon: "/icons/file.svg",
    kind: "folder",
    children: [
      {
        id: "stars",
        type: "stars",
        name: "STARS · CoRL 2026",
        icon: "folder",
        kind: "folder",
        position: "top-4 left-4",
        children: [
          {
            id: "stars-corl-2026",
            name: "paper.txt",
            icon: "txt",
            kind: "file",
            fileType: "txt",
            position: "top-4 left-4",
            data: {
              name: "STARS · paper.txt",
              subtitle: "Accepted at CoRL 2026",
              image: "/images/posters/poster-corl.svg",
              description: [
                "STARS: From Spatiotemporal Dynamics to Social Representations in Human-Robot Interaction.",
                "Tsoi, N., Munje, M. J., Oberoi, T., Maheshwari, R., Zheng, P., Chauhan, T., Stone, P., Biswas, J.",
                "Conference on Robot Learning (CoRL), 2026.",
                "How a robot can read social context from the way people move. I built the control baselines the learned representations were measured against: a raw-feature probe and a frozen MLP-autoencoder encoder, over 260 Optuna trials and 10-seed sweeps.",
                "The paper is not online yet. The proceedings are published with the conference, November 9 to 12 in Austin.",
              ],
            },
          },
        ],
      },
      {
        id: "memeqa",
        type: "memeqa",
        name: "MemeQA · ACL 2025",
        icon: "folder",
        kind: "folder",
        position: "top-4 left-32",
        children: [
          {
            id: "memeqa-acl-2025",
            name: "paper.txt",
            icon: "txt",
            kind: "file",
            fileType: "txt",
            position: "top-4 left-4",
            data: {
              name: "MemeQA · paper.txt",
              subtitle: "Published at ACL 2025",
              image: "/images/posters/poster-acl.svg",
              description: [
                "MemeQA: Holistic Evaluation for Meme Understanding.",
                "Nguyen, K. P. N., Li, T., Zhou, D. L., ..., Chauhan, T., et al.",
                "Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (ACL), 2025.",
                "A 9,000+ question multiple-choice benchmark for meme comprehension, built with Prof. Vincent Ng's group at UT Dallas. We benchmarked multimodal models against human baselines to measure the gap the dataset exists to close.",
              ],
            },
          },
          {
            id: "memeqa-link",
            name: "aclanthology.org",
            icon: "/icons/file.svg",
            kind: "link",
            fileType: "url",
            href: "https://aclanthology.org/2025.acl-long.927/",
            position: "top-4 left-32",
          },
          {
            id: "memeqa-dataset",
            name: "github.com",
            icon: "/icons/github.svg",
            kind: "link",
            fileType: "url",
            href: "https://github.com/npnkhoi/memeqa",
            position: "top-4 left-60",
          },
        ],
      },
    ],
  },
  about: {
    id: "about",
    type: "about",
    name: "About Me",
    icon: "/icons/user.svg",
    kind: "folder",
    children: [
      {
        id: "about-me",
        name: "about-me.txt",
        icon: "txt",
        kind: "file",
        fileType: "txt",
        position: "top-4 left-4",
        data: {
          name: "about-me.txt",
          subtitle: "Hey, I am Tanush",
          image: "/images/me.jpg",
          portrait: true,
          description: [
            "I am a CS Honors + Math double major at UT Austin (Dean's Scholars), minoring in Robotics. I build things that have to work in the physical world.",
            "Right now I am an undergraduate researcher at the Autonomous Mobile Robotics Lab, tracking people in 3D across six synchronized cameras with ROS2 and NVIDIA DeepStream.",
            "On campus I build with Texas Convergent and work on Longhorn Racing, and I used to coordinate the Agentic AI DiRP.",
            "tanush@utexas.edu",
          ],
        },
      },
      {
        id: "fun-facts",
        name: "fun-facts.txt",
        icon: "txt",
        kind: "file",
        fileType: "txt",
        position: "top-4 left-32",
        data: {
          name: "fun-facts.txt",
          subtitle: "Things my résumé does not say",
          description: [
            "I love exploring Austin. Most of my good ideas have come from random walks near campus with no destination in mind.",
            "I watch a lot of anime and I am always open to recommendations. All time favorites are Attack on Titan and Jujutsu Kaisen.",
            "I really like cooking. A few recipes I have iterated on for years, but most nights I am still getting my inspiration from YouTube and Instagram.",
            "I play intramural volleyball, with more enthusiasm than technique.",
          ],
        },
      },
      {
        id: "avatar-img",
        name: "me.png",
        icon: "image",
        kind: "file",
        fileType: "img",
        position: "top-4 left-60",
        data: { name: "me.png", imageUrl: "/images/me.jpg" },
      },
      {
        id: "poster",
        name: "get-to-know-me.png",
        icon: "image",
        kind: "file",
        fileType: "img",
        position: "top-32 left-4",
        data: {
          name: "get-to-know-me.png",
          imageUrl: "/images/poster-tanush.jpg",
        },
      },
    ],
  },
  trash: {
    id: "trash",
    type: "trash",
    name: "Trash",
    icon: "/icons/trash.svg",
    kind: "folder",
    children: [
      {
        id: "old-portfolio",
        name: "boring_portfolio_v1.txt",
        icon: "txt",
        kind: "file",
        fileType: "txt",
        position: "top-4 left-4",
        data: {
          name: "boring_portfolio_v1.txt",
          subtitle: "My first one, kept as a baseline",
          description: [
            "<html>",
            "  <h1>Hi, I am Tanush.</h1>",
            '  <img src="me.jpg" align="right" />',
            "  <p>Here are my projects. Please consider me.</p>",
            "</html>",
            "It worked. Nobody stayed longer than nine seconds.",
          ],
        },
      },
      {
        id: "centering-div",
        name: "how_to_center_a_div.txt",
        icon: "txt",
        kind: "file",
        fileType: "txt",
        position: "top-4 left-32",
        data: {
          name: "how_to_center_a_div.txt",
          subtitle: "Still the answer, most days",
          description: [
            "display: flex;",
            "justify-content: center;",
            "align-items: center;",
            "Every time, and I still look it up.",
          ],
        },
      },
    ],
  },
};

/* ---------------- window data, by reference ----------------
 * The store persists a node's id rather than a copy, so a reload always shows
 * the current text.
 */
const nodes = new Map(); // id -> node
const owners = new Map(); // a file's payload -> the id of the node holding it

const parents = new Map(); // id -> the folder holding it

const index = (node) => {
  nodes.set(node.id, node);
  if (node.data) owners.set(node.data, node.id);
  node.children?.forEach((child) => {
    parents.set(child.id, node);
    index(child);
  });
};

Object.values(locations).forEach(index);

export const parentOf = (id) => parents.get(id);

/** What to persist for a window. A gallery photo has no node, so it is kept whole. */
export const refFor = (data) => {
  if (!data) return null;
  const owner = owners.get(data);
  if (owner) return { ref: owner, part: "data" };
  if (data.id && nodes.has(data.id)) return { ref: data.id };
  return data;
};

/** Resolves a saved reference; null means the window stays shut. */
export const derefData = (saved) => {
  if (!saved?.ref) return saved ?? null;
  const node = nodes.get(saved.ref);
  if (!node) return null;
  return saved.part === "data" ? (node.data ?? null) : node;
};
