// Parody marks for the mail providers and support desks, drawn on a 24-unit grid. They hint at the real products
// through colour and a pun; none copies a real logo.
import type { ReactNode } from "react";

export type MarkProps = { className?: string };

const svg = (draw: ReactNode, label: string) => ({ className }: MarkProps) => (
  <svg className={`lucide mark${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" role="img" aria-label={label}>{draw}</svg>
);

// Goggle: a pair of swim goggles, one colour per part.
export const GoggleMark = svg(
  <>
    <path d="M1.5 12h2.2M20.3 12h2.2" stroke="oklch(0.65 0.17 150)" strokeWidth="2" strokeLinecap="round" />
    <rect x="3.7" y="8" width="7" height="8" rx="3.5" fill="white" stroke="oklch(0.58 0.19 255)" strokeWidth="2.2" />
    <rect x="13.3" y="8" width="7" height="8" rx="3.5" fill="white" stroke="oklch(0.6 0.22 27)" strokeWidth="2.2" />
    <path d="M10.7 11.2q1.3-1.4 2.6 0" fill="none" stroke="oklch(0.8 0.17 85)" strokeWidth="2" strokeLinecap="round" />
  </>,
  "Goggle Workspace",
);

// Lookout: an L panel in front of an envelope.
export const LookoutMark = svg(
  <>
    <rect x="8" y="6" width="13.5" height="12" rx="1.5" fill="oklch(0.8 0.08 245)" />
    <path d="M8.5 7.5 14.8 12l6.2-4.5" fill="none" stroke="oklch(0.42 0.15 255)" strokeWidth="1.3" strokeLinejoin="round" />
    <rect x="2.5" y="4" width="11" height="16" rx="2" fill="white" />
    <path d="M6 8v8h4.5" fill="none" stroke="oklch(0.42 0.16 255)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  "Lookout 365",
);

// Ionose: the lowercase word mark "io".
export const IonoseMark = svg(
  <>
    <rect x="5" y="10" width="3" height="8" rx="1" fill="white" />
    <circle cx="6.5" cy="6.5" r="1.8" fill="white" />
    <circle cx="14.5" cy="14" r="4.2" fill="none" stroke="white" strokeWidth="3" />
  </>,
  "Hosted Exchange by Ionose",
);

// GMix: an envelope with an orange X badge.
export const GMixMark = svg(
  <>
    <rect x="2.5" y="5" width="16" height="12" rx="2" fill="white" />
    <path d="M4 7 10.5 12 17 7" fill="none" stroke="oklch(0.5 0.15 250)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="17.5" cy="16.5" r="5" fill="oklch(0.72 0.18 50)" />
    <path d="M15.5 14l4 5m0-5-4 5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  "GMix",
);

// Pear Mail: a white envelope with a pear leaf.
export const PearMailMark = svg(
  <>
    <rect x="3" y="6.5" width="18" height="12.5" rx="2.2" fill="white" />
    <path d="M4 8.5 12 14l8-5.5" fill="none" stroke="oklch(0.55 0.1 245)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.5 5.5c.4-2 2-3 4-3-.3 2-1.8 3.2-4 3z" fill="oklch(0.78 0.16 135)" />
  </>,
  "Pear Mail",
);

// OsTickit: an orange ticket stub.
export const OsTickitMark = svg(
  <>
    <path d="M3 7h18v3.2a1.8 1.8 0 0 0 0 3.6V17H3v-3.2a1.8 1.8 0 0 0 0-3.6z" fill="oklch(0.72 0.17 52)" />
    <path d="M9 7v10" stroke="white" strokeWidth="1.3" strokeDasharray="1.5 1.5" />
    <path d="M12 10.5h6M12 13.5h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </>,
  "OsTickit",
);

// Zendusk: a setting sun on a calm horizon.
export const ZenduskMark = svg(
  <>
    <path d="M5 15.5a7 7 0 0 1 14 0z" fill="white" />
    <path d="M12 4v2.2M5.2 7.2l1.6 1.5M18.8 7.2l-1.6 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 18.5h14M8 21h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </>,
  "Zendusk",
);

// Freshdusk: a speech bubble with a leaf.
export const FreshduskMark = svg(
  <>
    <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" fill="white" />
    <path d="M8.5 12.5c0-3 2.5-4.6 6.5-4.6 0 3.9-1.8 5.6-4.6 5.6" fill="oklch(0.62 0.14 185)" />
    <path d="M8.3 13.4 12 10" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
  </>,
  "Freshdusk",
);

// FreeScoot: a kick scooter.
export const FreeScootMark = svg(
  <>
    <circle cx="6" cy="18" r="2.4" fill="none" stroke="white" strokeWidth="1.8" />
    <circle cx="18.5" cy="18" r="2.4" fill="none" stroke="white" strokeWidth="1.8" />
    <path d="M8.4 18H17l-1-12.5M14 5.5h4" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  "FreeScoot",
);
