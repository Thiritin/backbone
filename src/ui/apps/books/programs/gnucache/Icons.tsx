import type { ReactNode } from "react";

// Flat toolbar glyphs on a 16 grid, drawn in the program's current colour.
const P: Record<string, ReactNode> = {
  save: <><path d="M2 2h10l2 2v10H2z" /><path d="M5 2v4h6V2M5 14v-4h6v4" /></>,
  new: <><path d="M4 1.5h5l3 3v10H4z" /><path d="M9 1.5v3h3M8 7v5M5.5 9.5h5" /></>,
  open: <><path d="M1.5 4h5l1.5 1.5h6.5v8h-13z" /><path d="M1.5 7.5h13" /></>,
  close: <><rect x="2" y="2" width="12" height="12" /><path d="M5.5 5.5l5 5m0-5l-5 5" /></>,
  reconcile: <><path d="M2 8.5l3.5 3.5L14 3.5" /><path d="M2 3h6M2 14h12" /></>,
  enter: <><path d="M13 3v6H4" /><path d="M7 6L4 9l3 3" /></>,
  cancel: <><circle cx="8" cy="8" r="6" /><path d="M5.5 5.5l5 5m0-5l-5 5" /></>,
};

export const GcIcon = ({ id }: { id: keyof typeof P }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden>{P[id]}</svg>
);
