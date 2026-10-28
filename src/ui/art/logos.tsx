// Parody provider marks on a 16-unit grid; each hints at its company through name and colour only.
import { House } from "lucide-react";
import type { ReactNode } from "react";

interface Mark { word: string; color: string; weight?: number; caps?: boolean; draw: (c: string) => ReactNode }

const MARKS: Record<string, Mark> = {
  equinox: { word: "Equinox", color: "oklch(0.58 0.22 27)", weight: 750, caps: true, draw: (c) => <><circle cx="8" cy="8" r="6.5" fill="none" stroke={c} strokeWidth="2" /><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill={c} /></> },
  interaction: { word: "interaction", color: "oklch(0.52 0.2 300)", weight: 600, draw: (c) => <><path d="M2.5 3.5 7 8l-4.5 4.5" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="oklch(0.66 0.12 190)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></> },
  mainqubes: { word: "mainqubes", color: "oklch(0.6 0.14 160)", weight: 650, draw: (c) => <><rect x="1.5" y="8.5" width="6" height="6" rx="1" fill={c} /><rect x="8.5" y="8.5" width="6" height="6" rx="1" fill={c} opacity="0.6" /><rect x="5" y="1.5" width="6" height="6" rx="1" fill={c} opacity="0.85" /></> },
  hetzler: { word: "Hetzler", color: "oklch(0.57 0.22 25)", weight: 800, caps: true, draw: (c) => <><rect x="1" y="1" width="14" height="14" rx="3" fill={c} /><path d="M5 4v8M11 4v8M5 8h6" stroke="white" strokeWidth="2" strokeLinecap="round" /></> },
  tellyhouse: { word: "Tellyhouse", color: "oklch(0.45 0.13 262)", weight: 650, draw: (c) => <><path d="M2 14 8 3l6 11" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" /><path d="M5 9h6" stroke={c} strokeWidth="1.6" /><circle cx="8" cy="2.5" r="1.6" fill="oklch(0.62 0.2 25)" /></> },
  globalsnitch: { word: "Global Snitch", color: "oklch(0.48 0.12 245)", weight: 650, draw: (c) => <><circle cx="8" cy="8" r="6.5" fill="none" stroke={c} strokeWidth="1.6" /><path d="M2.5 8C4.5 5 11.5 5 13.5 8 11.5 11 4.5 11 2.5 8z" fill={c} /><circle cx="8" cy="8" r="1.8" fill="oklch(0.75 0.15 70)" /></> },
  docklands: { word: "Docklands Data", color: "oklch(0.42 0.08 240)", weight: 600, draw: (c) => <><path d="M1.5 6c2-2 4 2 6.5 0s4.5 2 6.5 0M1.5 10.5c2-2 4 2 6.5 0s4.5 2 6.5 0" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><rect x="6" y="1" width="4" height="3" rx="0.6" fill={c} /></> },
  ironmolehill: { word: "Iron Molehill", color: "oklch(0.5 0.13 250)", weight: 650, draw: (c) => <><path d="M1 14.5C3 7 6 4.5 8 4.5s5 2.5 7 10z" fill={c} /><circle cx="8" cy="9.5" r="1.4" fill="white" /></> },
  data5: { word: "data5", color: "oklch(0.55 0.15 235)", weight: 700, draw: (c) => <><path d="M8 1 14 4.5v7L8 15 2 11.5v-7z" fill={c} /><path d="M10 5H6.5L6 8h2.2a2 2 0 0 1 0 4H6" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></> },
  ntd: { word: "NTD", color: "oklch(0.5 0.17 258)", weight: 750, caps: true, draw: (c) => <><circle cx="8" cy="8" r="5.8" fill="none" stroke={c} strokeWidth="2.6" /><circle cx="8" cy="8" r="1.8" fill={c} /></> },
  spree: { word: "Spree Colo", color: "oklch(0.58 0.12 210)", weight: 600, draw: (c) => <path d="M3 2c5 2-3 5 2 7.5S11 12 13 14" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" /> },
  arubaba: { word: "arubaba", color: "oklch(0.65 0.18 50)", weight: 700, draw: (c) => <><circle cx="8" cy="8" r="4" fill={c} /><path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3 3l1.3 1.3M11.7 11.7 13 13M13 3l-1.3 1.3M4.3 11.7 3 13" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></> },
  nextlair: { word: "next lair", color: "oklch(0.55 0.15 145)", weight: 600, draw: (c) => <><path d="M3 9.5 8 5l5 4.5" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 14 8 9.5l5 4.5" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" /><path d="M5 2h6" stroke={c} strokeWidth="2" strokeLinecap="round" /></> },
  greenchz: { word: "green.chz", color: "oklch(0.6 0.16 140)", weight: 650, draw: (c) => <><path d="M2.5 13.5C2.5 6 7 2.5 13.5 2.5 13.5 9 10 13.5 2.5 13.5z" fill={c} /><path d="M2.5 13.5 9 7" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></> },
};

// A provider's mark, with its wordmark when `word` is set; no provider means the basement.
export function Logo({ provider, size = 16, word = false }: { provider: string | null; size?: number; word?: boolean }) {
  const m = provider ? MARKS[provider] : undefined;
  if (!m) return <House className="logo-mark" width={size} height={size} strokeWidth={1.75} aria-hidden="true" />;
  const svg = <svg className="logo-mark" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">{m.draw(m.color)}</svg>;
  if (!word) return svg;
  return (
    <span className="logo">
      {svg}
      <span className="logo-word" style={{ fontWeight: m.weight ?? 600, textTransform: m.caps ? "uppercase" : undefined, letterSpacing: m.caps ? "0.02em" : "-0.01em" }}>{m.word}</span>
    </span>
  );
}
