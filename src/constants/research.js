/**
 * The papers, in one place. The Finder builds its Publications folder from
 * these and the research page renders them directly, so a new paper is one
 * entry rather than two.
 */
export const papers = [
  {
    id: "stars",
    short: "STARS",
    title: "STARS: From Spatiotemporal Dynamics to Social Representations in Human-Robot Interaction",
    authors:
      "Tsoi, N., Munje, M. J., Oberoi, T., Maheshwari, R., Zheng, P., Chauhan, T., Stone, P., Biswas, J.",
    me: "Chauhan, T.",
    venue: "Conference on Robot Learning (CoRL)",
    venueShort: "CoRL",
    venueLine: "Conference on Robot Learning (CoRL), 2026.",
    year: 2026,
    status: "Accepted",
    subtitle: "Accepted at CoRL 2026",
    image: "/images/posters/poster-corl.svg",
    summary:
      "How a robot can read social context from the way people move. I built the control baselines the learned representations were measured against: a raw-feature probe and a frozen MLP-autoencoder encoder, over 260 Optuna trials and 10-seed sweeps.",
    note: "The paper is not online yet. The proceedings are published with the conference, November 9 to 12 in Austin.",
    links: [],
  },
  {
    id: "memeqa",
    short: "MemeQA",
    title: "MemeQA: Holistic Evaluation for Meme Understanding",
    authors: "Nguyen, K. P. N., Li, T., Zhou, D. L., ..., Chauhan, T., et al.",
    me: "Chauhan, T.",
    venue: "Annual Meeting of the Association for Computational Linguistics (ACL)",
    venueShort: "ACL",
    venueLine:
      "Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (ACL), 2025.",
    year: 2025,
    status: "Published",
    subtitle: "Published at ACL 2025",
    image: "/images/posters/poster-acl.svg",
    summary:
      "A 9,000+ question multiple-choice benchmark for meme comprehension, built with Prof. Vincent Ng's group at UT Dallas. We benchmarked multimodal models against human baselines to measure the gap the dataset exists to close.",
    note: null,
    links: [
      { label: "aclanthology.org", href: "https://aclanthology.org/2025.acl-long.927/" },
      { label: "github.com", href: "https://github.com/npnkhoi/memeqa" },
    ],
  },
];
