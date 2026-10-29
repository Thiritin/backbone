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
  grenkel: { word: "Grenkel Leasing", color: "oklch(0.55 0.11 200)", weight: 650, draw: (c) => <><rect x="1" y="1" width="14" height="14" rx="3.5" fill={c} /><path d="M4.5 6h7M4.5 10h4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></> },
  leasling: { word: "Deutsche Leasling", color: "oklch(0.48 0.15 255)", weight: 650, draw: (c) => <><path d="M8 15V8" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><path d="M8 9C8 5 5 3 2 3.5 2 7 4.5 9 8 9zM8 7.5c0-3 2.2-5 5.5-5 0 3.2-2 5-5.5 5z" fill={c} /></> },
  parasol: { word: "BNP Parasol", color: "oklch(0.55 0.13 160)", weight: 700, draw: (c) => <><path d="M1.5 8.5a6.5 6.5 0 0 1 13 0z" fill={c} /><path d="M8 8.5V13a1.5 1.5 0 0 1-3 0" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></> },
  // Internet providers for the basement line.
  "deutsche-telekomm": { word: "Deutsche Telekomm", color: "oklch(0.58 0.24 350)", weight: 700, draw: (c) => <><path d="M3 3.5h10M8 3.5V14" stroke={c} strokeWidth="2.4" strokeLinecap="round" /><rect x="2" y="7" width="2.2" height="2.2" fill={c} /><rect x="11.8" y="7" width="2.2" height="2.2" fill={c} /></> },
  vodafoam: { word: "Vodafoam", color: "oklch(0.58 0.23 27)", weight: 700, draw: (c) => <><circle cx="8" cy="8" r="6.5" fill={c} /><path d="M9.5 4.5c-2.5 0-4 1.6-4 3.8S7 12 9 12c1.2 0 1.8-.8 1.8-1.7 0-1.5-1.8-1.7-1.8-3.2 0-1 .3-1.9.5-2.6z" fill="white" /></> },
  "1&2": { word: "1&2", color: "oklch(0.45 0.16 262)", weight: 750, draw: (c) => <><rect x="1" y="1" width="14" height="14" rx="3" fill={c} /><path d="M5 5.5 6.5 4.5V11.5M9.5 6a1.6 1.6 0 0 1 3 .8c0 1.4-3 2.6-3 4.7h3" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></> },
  "deutsche-glasfasel": { word: "Deutsche Glasfasel", color: "oklch(0.6 0.16 145)", weight: 650, draw: (c) => <><path d="M2 12c3-6 9-6 12-8M2 8.5c3-4 7-4 10-6M4 14.5c3-5 7-6 10-6" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></> },
  // Hardware manufacturers, keyed by catalog id.
  dwell: { word: "Dwell", color: "oklch(0.55 0.15 245)", weight: 650, draw: (c) => <><circle cx="8" cy="8" r="6.3" fill="none" stroke={c} strokeWidth="2" /><rect x="5.5" y="5.5" width="5" height="5" rx="1" fill={c} /></> },
  "hewlett-packet": { word: "Hewlett-Packet", color: "oklch(0.6 0.15 165)", weight: 650, draw: (c) => <><rect x="1" y="3.5" width="14" height="9" rx="1.5" fill={c} /><path d="M2.5 5l5.5 4 5.5-4" fill="none" stroke="white" strokeWidth="1.4" strokeLinejoin="round" /></> },
  supermacro: { word: "SuperMacro", color: "oklch(0.55 0.14 150)", weight: 700, draw: (c) => <><rect x="1" y="1" width="14" height="14" rx="2" fill={c} /><path d="M4 11.5V8h2.7V4.5H12" fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></> },
  lenovoid: { word: "Lenovoid", color: "oklch(0.56 0.21 27)", weight: 650, draw: (c) => <><rect x="1" y="2.5" width="14" height="11" rx="2" fill={c} /><circle cx="8" cy="8" r="2.8" fill="none" stroke="white" strokeWidth="1.6" /></> },
  sysko: { word: "Sysko", color: "oklch(0.58 0.13 230)", weight: 650, draw: (c) => <><path d="M3 11a5 5 0 0 1 10 0M5.3 11a2.7 2.7 0 0 1 5.4 0" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="11" r="1.2" fill={c} /></> },
  junipurr: { word: "Junipurr", color: "oklch(0.58 0.13 155)", weight: 650, draw: (c) => <path d="M2 14V3.5l3.5 3h5L14 3.5V14z" fill={c} /> },
  avn: { word: "AVN", color: "oklch(0.55 0.2 20)", weight: 750, caps: true, draw: (c) => <><rect x="1" y="1" width="14" height="14" rx="3" fill={c} /><path d="M4.5 12 8 4l3.5 8M5.8 9.4h4.4" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></> },
  microtick: { word: "MicroTick", color: "oklch(0.5 0.14 290)", weight: 650, draw: (c) => <><circle cx="8" cy="8" r="6.5" fill={c} /><path d="M4.6 8.4 7 10.8l4.4-5.2" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></> },
  aristotle: { word: "Aristotle", color: "oklch(0.42 0.1 255)", weight: 650, draw: (c) => <><path d="M2 3.5h12M2.5 14h11" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><path d="M4.5 5.5v6.5M8 5.5v6.5M11.5 5.5v6.5" stroke={c} strokeWidth="1.6" /></> },
  fortinope: { word: "Fortinope", color: "oklch(0.56 0.21 27)", weight: 700, draw: (c) => <><path d="M8 1 14 3.3v4.2C14 11 11.5 13.6 8 15 4.5 13.6 2 11 2 7.5V3.3z" fill={c} /><path d="M5.2 8h5.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></> },
  "pablo-alto": { word: "Pablo Alto", color: "oklch(0.68 0.17 55)", weight: 650, draw: (c) => <><path d="M8 1.5c3.8 0 6.5 2.6 6.5 5.7 0 2.2-1.7 2.6-3 2.3-1.4-.3-2 .6-1.6 1.6.5 1.4-.3 3.4-2.4 3.4-3.6 0-6-2.9-6-6.4S4.4 1.5 8 1.5z" fill={c} /><circle cx="5.5" cy="6" r="1.1" fill="white" /><circle cx="9" cy="4.6" r="1.1" fill="white" /></> },
  pandoot: { word: "Pandoot", color: "oklch(0.45 0.12 255)", weight: 650, draw: (c) => <><rect x="1" y="3" width="14" height="10" rx="1.5" fill={c} /><path d="M3.5 6.5h2M7 6.5h2M10.5 6.5h2M3.5 9.5h2M7 9.5h2M10.5 9.5h2" stroke="white" strokeWidth="1.6" /></> },
  eatin: { word: "Eatin", color: "oklch(0.5 0.14 250)", weight: 700, draw: (c) => <><path d="M9.5 1.5 3.5 9h4l-1 5.5 6-7.5h-4z" fill={c} /></> },
  greenchz: { word: "green.chz", color: "oklch(0.6 0.16 140)", weight: 650, draw: (c) => <><path d="M2.5 13.5C2.5 6 7 2.5 13.5 2.5 13.5 9 10 13.5 2.5 13.5z" fill={c} /><path d="M2.5 13.5 9 7" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></> },
  skyblink: { word: "SkyBlink", color: "oklch(0.6 0.15 235)", weight: 700, draw: (c) => <><path d="M2 11.5a4 4 0 0 1 3.6-4A4.8 4.8 0 0 1 14 9.3a2.6 2.6 0 0 1-.6 5.2H4.5A2.5 2.5 0 0 1 2 11.5z" fill={c} /><path d="M6.5 11.3h3" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></> },
  borisnet: { word: "boris network", color: "oklch(0.5 0.16 255)", weight: 650, draw: (c) => <><circle cx="8" cy="8" r="6.5" fill={c} /><path d="M5.5 4.5v7h3a2 2 0 0 0 0-4h-3m3 0a1.7 1.7 0 0 0 0-3h-3" fill="none" stroke="white" strokeWidth="1.4" strokeLinejoin="round" /></> },
  digitalreality: { word: "Digital Reality", color: "oklch(0.55 0.17 255)", weight: 650, draw: (c) => <><path d="M2 2h6a6 6 0 0 1 0 12H2z" fill={c} /><path d="M5 5v6" stroke="white" strokeWidth="1.6" strokeLinecap="round" /></> },
  corespite: { word: "CoreSpite", color: "oklch(0.55 0.14 160)", weight: 700, draw: (c) => <><circle cx="8" cy="8" r="6.5" fill="none" stroke={c} strokeWidth="2" /><circle cx="8" cy="8" r="2.6" fill={c} /></> },
  telex: { word: "TELEX", color: "oklch(0.45 0.05 260)", weight: 800, caps: true, draw: (c) => <><rect x="1.5" y="3" width="13" height="10" rx="1.5" fill={c} /><path d="M4 6.5h8M4 9.5h5" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></> },
};

const brandId = (brand: string) => brand.toLowerCase().replace(/ /g, "-");

// A manufacturer's mark inside a device drawing, at (x, y) and `size` px.
export function BrandMark({ brand, x, y, size }: { brand: string; x: number; y: number; size: number }) {
  const m = MARKS[brandId(brand)];
  return m ? <g transform={`translate(${x} ${y}) scale(${size / 16})`} aria-hidden="true">{m.draw(m.color)}</g> : null;
}

export const brandColor = (brand: string) => MARKS[brandId(brand)]?.color ?? "oklch(0.5 0.01 255)";

export const BrandLogo = ({ brand, size = 16, word = false }: { brand: string; size?: number; word?: boolean }) => <Logo provider={brandId(brand)} size={size} word={word} />;

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
