export const navLinks = [
  { id: 1, name: "Projects", type: "finder" },
  { id: 2, name: "Contact", type: "contact" },
];

export const navIcons = [
  { id: 1, img: "/icons/wifi.svg" },
  { id: 2, img: "/icons/search.svg" },
];

/**
 * Each wallpaper is a pair, because light and dark are not a filter over one
 * image here: the Austin one is the same hills at golden hour and after dark,
 * and picking a wallpaper should not stop the theme from meaning anything.
 * The first entry is the default and the one every visitor lands on.
 */
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
  },
];

export const DEFAULT_WALLPAPER = wallpapers[0].id;

/** Falls back rather than throwing: a saved id can outlive its wallpaper. */
export const wallpaperFor = (id, dark) => {
  const paper = wallpapers.find((w) => w.id === id) ?? wallpapers[0];
  return dark ? paper.dark : paper.light;
};

export const dockApps = [
  { id: "finder", name: "Projects", icon: "finder.png", canOpen: true },
  { id: "safari", name: "Highlights", icon: "safari.png", canOpen: true },
  { id: "photos", name: "Gallery", icon: "photos.png", canOpen: true },
  { id: "terminal", name: "Terminal", icon: "terminal.png", canOpen: true },
  { id: "contact", name: "Contact", icon: "contact.png", canOpen: true },
  { id: "guestbook", name: "Guestbook", icon: "guestbook.svg", canOpen: true },
  { id: "trash", name: "Trash", icon: "trash.png", canOpen: true },
];

export const techStack = [
  {
    category: "Languages",
    items: [
      "Java",
      "Python",
      "C/C++",
      "SQL",
      "JavaScript",
      "TypeScript",
      "Swift",
    ],
  },
  {
    category: "Web",
    items: ["React", "Next.js", "Tailwind CSS", "FastAPI"],
  },
  {
    category: "Mobile",
    items: ["React Native", "Flutter", "SwiftUI"],
  },
  {
    category: "AI / ML",
    items: ["AWS Bedrock", "NVIDIA NIM", "Ollama", "pgvector", "OpenAI APIs"],
  },
  {
    category: "Robotics",
    items: ["ROS2", "NVIDIA DeepStream", "Docker", "LiDAR + RGB fusion"],
  },
  {
    category: "Cloud & Data",
    items: ["Supabase (PostgreSQL)", "AWS Lambda", "Oracle Cloud", "Git"],
  },
];

// Safari "reading list": the four things I would point at first.
export const highlights = [
  {
    id: 1,
    tag: "Publication",
    title: "MemeQA: Holistic Evaluation for Meme Understanding · ACL 2025",
    description:
      "Co-authored a 9,000+ question benchmark for meme comprehension, published at the 63rd Annual Meeting of the ACL.",
    image: "/images/posters/poster-acl.svg",
    link: "https://scholar.google.com/scholar?q=MemeQA+Holistic+Evaluation+for+Meme+Understanding",
    cta: "Read the paper",
  },
  {
    id: 2,
    tag: "Hackathon Win",
    title: "Crave · Best Use of Supabase & Most Startup Ready",
    description:
      "An AI dining concierge with a voice agent, group-preference reconciliation via pgvector, and receipt-OCR bill splitting. Hook 'Em Hacks 2026 @ UT Austin.",
    image: "/images/projects/crave.jpg",
    link: "https://devpost.com/software/crave-onrtlb",
    cta: "See it on Devpost",
  },
  {
    id: 3,
    tag: "Research",
    title: "Autonomous Mobile Robotics Lab @ UT Austin",
    description:
      "Building ROS2 human-tracking pipelines, fusing LiDAR and RGB streams, SAM3 segmentation, and Dockerized DeepStream nodes for multi-view 3D person tracking.",
    image: "/images/posters/poster-robot.svg",
    link: "https://www.linkedin.com/in/tanushchauhan",
    cta: "More on LinkedIn",
  },
  {
    id: 4,
    tag: "Shipped",
    title: "GradeMate · 1,180+ installs and counting",
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
  // `focus: "top"` anchors the thumbnail crop to the top of the source, so the
  // portrait keeps the face and the poster keeps its header instead of showing
  // a band of body text. Everything else is already 16:9 and crops centred.
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
  icon: "/images/folder.png",
  kind: "folder",
  windowPosition,
  position,
  children: [
    {
      id: `${id}-about`,
      name: "about.txt",
      icon: "/images/txt.png",
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
            icon: "/images/image.png",
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
          subtitle: "Edge-AI wildlife detection · Texas Convergent IoT Case",
          image: "/images/projects/shoo.jpg",
          description: [
            "Shoo! is an edge-AI wildlife detection product. Ultrasonic + GPS-triggered ESP32-CAM captures stream to an on-prem Python server running Qwen2.5-VL locally for species identification, then sync to a community mobile app via Supabase Realtime.",
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
            icon: "/images/image.png",
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
        icon: "/images/txt.png",
        kind: "file",
        fileType: "txt",
        position: "top-4 left-4",
        data: {
          name: "about-me.txt",
          subtitle: "Hey, I am Tanush",
          image: "/images/me.jpg",
          portrait: true,
          description: [
            "I am a CS Honors + Math double major at UT Austin (Dean's Scholars), minoring in Robotics. I build things that have to work in the physical world, where the hard part is never the code.",
            "Right now I am an undergraduate researcher at the Autonomous Mobile Robotics Lab, working with ROS and Nvidia Deepstream.",
            "tanush@utexas.edu",
          ],
        },
      },
      {
        id: "fun-facts",
        name: "fun-facts.txt",
        icon: "/images/txt.png",
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
          ],
        },
      },
      {
        id: "avatar-img",
        name: "me.png",
        icon: "/images/image.png",
        kind: "file",
        fileType: "img",
        position: "top-4 left-60",
        data: { name: "me.png", imageUrl: "/images/me.jpg" },
      },
      {
        id: "poster",
        name: "get-to-know-me.png",
        icon: "/images/image.png",
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
        icon: "/images/txt.png",
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
        icon: "/images/txt.png",
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
 *
 * A window's `data` is a node out of this file, and the window store persists
 * it. A copy written to localStorage months ago then outlives the copy in the
 * build: change a project's blurb and anyone who had that folder open still
 * reads the old one, because nothing on a reload goes looking for a newer
 * version. Clearing site data was the only cure.
 *
 * So the store saves a reference and resolves it against the current build on
 * the way back in. Positions and sizes still persist; the words never do.
 */
const nodes = new Map(); // id -> node
const owners = new Map(); // a file's payload -> the id of the node holding it

const index = (node) => {
  nodes.set(node.id, node);
  if (node.data) owners.set(node.data, node.id);
  node.children?.forEach(index);
};

Object.values(locations).forEach(index);

/**
 * What to persist for a window.
 *
 * A photo opened from the gallery is built on the fly and has no node behind
 * it, so there is nothing to look up and it is kept whole. It is two fields
 * and a path, which is about as little as a snapshot can go stale by.
 */
export const refFor = (data) => {
  if (!data) return null;
  const owner = owners.get(data);
  if (owner) return { ref: owner, part: "data" };
  if (data.id && nodes.has(data.id)) return { ref: data.id };
  return data;
};

/**
 * The other direction, run on hydrate. A reference this build no longer has
 * resolves to null, and the store reads that as a window to leave shut.
 */
export const derefData = (saved) => {
  if (!saved?.ref) return saved ?? null;
  const node = nodes.get(saved.ref);
  if (!node) return null;
  return saved.part === "data" ? (node.data ?? null) : node;
};
