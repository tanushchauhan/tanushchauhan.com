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
  { id: "trash", name: "Trash", icon: "trash.png", canOpen: true },
];

export const techStack = [
  {
    category: "Languages",
    items: ["Java", "Python", "C/C++", "SQL", "JavaScript", "TypeScript", "Swift"],
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
    image: "/images/posters/poster-crave.svg",
    link: "https://github.com/tanushchauhan",
    cta: "See it on GitHub",
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
    image: "/images/posters/poster-grademate.svg",
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
  { id: 1, name: "crave.png", group: "Projects", image: "/images/posters/poster-crave.svg" },
  { id: 2, name: "shoo.png", group: "Projects", image: "/images/posters/poster-shoo.svg" },
  { id: 3, name: "kindred.png", group: "Projects", image: "/images/posters/poster-kindred.svg" },
  { id: 4, name: "prism.png", group: "Projects", image: "/images/posters/poster-prism.svg" },
  { id: 5, name: "grademate.png", group: "Projects", image: "/images/posters/poster-grademate.svg" },
  { id: 6, name: "memeqa-acl2025.png", group: "Research & Awards", image: "/images/posters/poster-acl.svg" },
  { id: 7, name: "amrl-research.png", group: "Research & Awards", image: "/images/posters/poster-robot.svg" },
  { id: 8, name: "eye-tracker.png", group: "Research & Awards", image: "/images/posters/poster-eye.svg" },
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
          image: "/images/posters/poster-crave.svg",
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
            name: "github.com",
            icon: "/icons/github.svg",
            kind: "link",
            fileType: "url",
            href: "https://github.com/tanushchauhan",
            position: "top-4 left-32",
          },
          {
            id: "crave-img",
            name: "poster.png",
            icon: "/images/image.png",
            kind: "file",
            fileType: "img",
            position: "top-4 left-60",
            data: { name: "crave · poster.png", imageUrl: "/images/posters/poster-crave.svg" },
          },
        ]
      ),
      project(
        "shoo",
        "Shoo!",
        "top-[24vh] right-[2vw]",
        "top-4 left-32",
        {
          name: "Shoo! · about.txt",
          subtitle: "Edge-AI wildlife detection · Texas Convergent IoT Case",
          image: "/images/posters/poster-shoo.svg",
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
            href: "https://github.com/tanushchauhan",
            position: "top-4 left-32",
          },
          {
            id: "shoo-img",
            name: "poster.png",
            icon: "/images/image.png",
            kind: "file",
            fileType: "img",
            position: "top-4 left-60",
            data: { name: "shoo · poster.png", imageUrl: "/images/posters/poster-shoo.svg" },
          },
        ]
      ),
      project(
        "kindred",
        "Kindred",
        "top-[42vh] right-[2vw]",
        "top-4 left-60",
        {
          name: "Kindred · about.txt",
          subtitle: "AI marketplace · Texas Convergent Health Tech Case",
          image: "/images/posters/poster-kindred.svg",
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
            href: "https://github.com/tanushchauhan",
            position: "top-4 left-32",
          },
        ]
      ),
      project(
        "prism",
        "Prism",
        "top-[6vh] right-[10vw]",
        "top-40 left-4",
        {
          name: "Prism · about.txt",
          subtitle: "Multi-agent product strategy platform",
          image: "/images/posters/poster-prism.svg",
          description: [
            "Prism is an AI-driven, multi-agent product strategy platform. FastAPI orchestrates parallel NVIDIA Nemotron LLM workflows, and React Flow + Jira/Auth0 integrations convert AI outputs into authenticated epics and tickets.",
            "Stack: React 18 · FastAPI · React Flow · NVIDIA Nemotron · Auth0 · Jira",
          ],
        },
        [
          {
            id: "prism-gh",
            name: "github.com",
            icon: "/icons/github.svg",
            kind: "link",
            fileType: "url",
            href: "https://github.com/tanushchauhan",
            position: "top-4 left-32",
          },
        ]
      ),
      project(
        "grademate",
        "GradeMate",
        "top-[24vh] right-[10vw]",
        "top-40 left-32",
        {
          name: "GradeMate · about.txt",
          subtitle: "900+ students · live on the App Store",
          image: "/images/posters/poster-grademate.svg",
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
        ]
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
          image: "/images/avatar-tanush.svg",
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
            "🤖 I've taught a robot to follow a specific human through a crowd. It's less creepy than it sounds. Mostly.",
            "📄 My first academic publication is about memes. My parents are still deciding how to feel about it.",
            "👁️ I helped build an eye tracker that controls a robotic arm, and it won Best Overall Project at ECLAIR Robotics.",
            "📱 An app I built is quietly doing GPA math for 900+ students so they don't have to.",
            "🧮 I added the Math half of my degree because linear algebra kept showing up in the robotics code anyway.",
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
        data: { name: "me.png", imageUrl: "/images/avatar-tanush.svg" },
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
            "  <img src=\"me.jpg\" align=\"right\" />",
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
          description: ["display: flex;", "justify-content: center;", "align-items: center;", "You never know when you'll need it again."],
        },
      },
    ],
  },
};
