import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./ui/desktop/shell.css";
import "./ui/desktop/desktop.css";
import "./ui/desktop/os.css";
import { Desktop } from "./ui/desktop/Desktop";
import { MobileGate, isMobile } from "./ui/desktop/MobileGate";

createRoot(document.getElementById("root")!).render(<StrictMode>{isMobile ? <MobileGate /> : <Desktop />}</StrictMode>);
