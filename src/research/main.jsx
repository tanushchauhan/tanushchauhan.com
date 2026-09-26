import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Research from "./Research.jsx";
import "./research.css";

// this page has no theme switch of its own; it follows the system
const dark = window.matchMedia("(prefers-color-scheme: dark)");
const apply = () => document.documentElement.classList.toggle("dark", dark.matches);
apply();
dark.addEventListener("change", apply);

createRoot(document.getElementById("paper")).render(
  <StrictMode>
    <Research />
  </StrictMode>
);
