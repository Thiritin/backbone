// Parody marks for the mail providers and support desks, drawn on a 24-unit grid. They hint at the real products
// through colour and a loose idea only; none copies a real logo.
import type { ReactNode } from "react";

export type MarkProps = { className?: string };

const svg = (draw: ReactNode, label: string) => ({ className }: MarkProps) => (
  <svg className={`lucide mark${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" role="img" aria-label={label}>{draw}</svg>
);

// Envelope outline split into four sides, one colour each.
export const GoggleMark = svg(
  <>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="white" />
    <path d="M5.5 5.5h13" stroke="oklch(0.6 0.19 255)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M21 8v8" stroke="oklch(0.62 0.22 27)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M18.5 18.5h-13" stroke="oklch(0.65 0.17 150)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M3 16V8" stroke="oklch(0.82 0.17 90)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M5 8.5 12 13.5 19 8.5" fill="none" stroke="oklch(0.55 0.02 255)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  "Goggle Workspace",
);

// Blue envelope with a round O badge.
export const LookoutMark = svg(
  <>
    <rect x="2.5" y="5" width="19" height="13" rx="2" fill="white" />
    <path d="M4.5 7.5 12 13 19.5 7.5" fill="none" stroke="oklch(0.45 0.16 255)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8" cy="16" r="5.5" fill="oklch(0.42 0.17 258)" />
    <circle cx="8" cy="16" r="2.3" fill="none" stroke="white" strokeWidth="1.8" />
  </>,
  "Lookout 365",
);

// Ionose: a hexagon holding an ion orbit.
export const IonoseMark = svg(
  <>
    <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z" fill="white" />
    <ellipse cx="12" cy="12" rx="6.2" ry="2.6" fill="none" stroke="oklch(0.55 0.13 195)" strokeWidth="1.5" transform="rotate(-30 12 12)" />
    <ellipse cx="12" cy="12" rx="6.2" ry="2.6" fill="none" stroke="oklch(0.55 0.13 195)" strokeWidth="1.5" transform="rotate(30 12 12)" />
    <circle cx="12" cy="12" r="1.9" fill="oklch(0.4 0.12 215)" />
  </>,
  "Hosted Exchange by Ionose",
);

// Pear Mail: a plain white envelope.
export const PearMailMark = svg(
  <>
    <rect x="3" y="5.5" width="18" height="13" rx="2.2" fill="white" />
    <path d="M4 7.5 12 13.5 20 7.5" fill="none" stroke="oklch(0.55 0.03 255)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  "Pear Mail",
);

// OsTickit: a plain ticket stub.
export const OsTickitMark = svg(
  <>
    <path d="M3.5 7.5h17v3a1.8 1.8 0 0 0 0 3.6v3.4h-17v-3.4a1.8 1.8 0 0 0 0-3.6z" fill="white" />
    <path d="M9.5 7.5v10" stroke="oklch(0.5 0.01 255)" strokeWidth="1.3" strokeDasharray="1.6 1.6" />
    <path d="M12.5 11h5M12.5 14h3" stroke="oklch(0.5 0.01 255)" strokeWidth="1.4" strokeLinecap="round" />
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
