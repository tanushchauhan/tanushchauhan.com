export const navLinks = [
  { id: 1, name: "Projects", type: "finder" },
  { id: 2, name: "Résumé", type: "resume" },
  { id: 3, name: "Contact", type: "contact" },
];

export const navIcons = [
  { id: 1, img: "/icons/wifi.svg" },
  { id: 2, img: "/icons/search.svg" },
  { id: 3, img: "/icons/mode.svg" },
];

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

// Safari "reading list": the things worth bragging about.
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
    title: "GradeMate · 900+ students and counting",
    description:
      "A cross-platform grade tracker and GPA predictor, live on the App Store and running on Oracle Cloud.",
    image: "/images/projects/grademate.jpg",
    link: "https://github.com/tanushchauhan",
    cta: "See it on GitHub",
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
            "🏆 Won Best Use of Supabase and Most Startup Ready at Hook 'Em Hacks 2026 (UT Austin).",
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
            "🏆 Awarded Best Presentation by Texas Convergent (Spring 2026, IoT Case).",
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
            "🏆 Awarded Best Presentation by Texas Convergent (Fall 2025, Health Tech Case).",
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
            id: "prism-gh",
            name: "devpost.com",
            icon: "/icons/file.svg",
            kind: "link",
            fileType: "url",
            href: "https://devpost.com/software/prism-l2nb54",
            position: "top-4 left-32",
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
          subtitle: "900+ students · live on the App Store",
          image: "/images/projects/grademate.jpg",
          description: [
            "GradeMate is a cross-platform application used by 900+ students to track grades, calculate GPA, and predict grades.",
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
            href: "https://github.com/tanushchauhan",
            position: "top-4 left-32",
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
          subtitle: "Hey, I'm Tanush",
          image: "/images/me.jpg",
          description: [
            "I'm a CS Honors + Math double major at UT Austin ('29, Dean's Scholars), minoring in Robotics, and I like building things that live where software meets the physical world.",
            "Right now I'm an undergraduate researcher at the Autonomous Mobile Robotics Lab, teaching robots to track and follow humans by fusing LiDAR and RGB streams in ROS2. Before that, I co-authored MemeQA (yes, a peer-reviewed paper about memes), published at ACL 2025.",
            "When I'm not in the lab, I'm probably at a hackathon (Crave won Best Use of Supabase at Hook 'Em Hacks 2026), building with Texas Convergent, or making a robotic arm move with nothing but eye movements at ECLAIR Robotics.",
            "Austin, TX · tanush@utexas.edu",
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
          subtitle: "Things my résumé doesn't say",
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
  resume: {
    id: "resume",
    type: "resume",
    name: "Résumé",
    icon: "/icons/file.svg",
    kind: "folder",
    children: [
      {
        id: "resume-pdf",
        name: "resume.pdf",
        icon: "/images/pdf.png",
        kind: "file",
        fileType: "pdf",
        position: "top-4 left-4",
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
          subtitle: "Deleted for a reason",
          description: [
            "<html>",
            "  <h1>Hi, I'm Tanush.</h1>",
            '  <img src="me.jpg" align="right" />',
            "  <p>Here are my projects. Please consider me.</p>",
            "</html>",
            "…yeah. We don't do that anymore.",
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
          subtitle: "Kept for emergencies",
          description: [
            "display: flex;",
            "justify-content: center;",
            "align-items: center;",
            "You never know when you'll need it again.",
          ],
        },
      },
    ],
  },
};
