import type { ReactNode } from "react";

// The 16 pixel toolbar pictures of the classic program, drawn flat in the colours of the time.
const PICS: Record<string, ReactNode> = {
  open: <><path d="M1.5 4.5h4l1 1.5h7v7.5h-12z" fill="#f2cf5b" stroke="#9a7417" /><path d="M1.5 13.5l2-5.5h11.5l-2 5.5z" fill="#f8e08e" stroke="#9a7417" /></>,
  save: <><rect x="1.5" y="1.5" width="13" height="13" fill="#3b64b3" stroke="#1d3770" /><rect x="4" y="2" width="8" height="4.5" fill="#fff" /><rect x="4" y="9" width="8" height="5" fill="#d9d9d9" /><rect x="9" y="10" width="2" height="3" fill="#3b64b3" /></>,
  mask: <><rect x="2.5" y="1.5" width="9" height="13" fill="#fff" stroke="#6b6b6b" /><path d="M4 4.5h6M4 7h6M4 9.5h3" stroke="#7d93c4" /><path d="M8 13.5l1-3 5-5 2 2-5 5z" fill="#e8a33a" stroke="#7a4f12" /></>,
  stapel: <><rect x="4.5" y="1.5" width="9" height="10" fill="#e8e8e8" stroke="#7a7a7a" /><rect x="3" y="3" width="9" height="10" fill="#f4f4f4" stroke="#7a7a7a" /><rect x="1.5" y="4.5" width="9" height="10" fill="#fff" stroke="#6b6b6b" /><path d="M3 7.5h6M3 10h6M3 12.5h4" stroke="#7d93c4" /></>,
  op: <><rect x="1.5" y="1.5" width="13" height="13" fill="#fff" stroke="#6b6b6b" /><path d="M6 4.5h7M6 8h7M6 11.5h7" stroke="#555" /><rect x="3" y="3.5" width="2" height="2" fill="#c8102e" /><rect x="3" y="7" width="2" height="2" fill="#2f8f2f" /><rect x="3" y="10.5" width="2" height="2" fill="#c8102e" /></>,
  bank: <><path d="M1 6l7-4.5 7 4.5z" fill="#c9a13b" stroke="#6e5516" /><path d="M3 7v5M6.3 7v5M9.7 7v5M13 7v5" stroke="#6e6e6e" strokeWidth="1.6" /><rect x="1.5" y="12.5" width="13" height="2" fill="#9a9a9a" stroke="#555" /></>,
  susa: <><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#6b6b6b" /><path d="M1.5 5.5h13M6 2.5v11M10.5 2.5v11M1.5 9h13" stroke="#9aa9c8" /><rect x="2" y="3" width="12" height="2" fill="#3b64b3" /></>,
  tax: <><rect x="2.5" y="1.5" width="11" height="13" fill="#fff" stroke="#6b6b6b" /><circle cx="6" cy="6" r="1.5" fill="none" stroke="#c8102e" /><circle cx="10" cy="11" r="1.5" fill="none" stroke="#c8102e" /><path d="M5 12l6-7" stroke="#c8102e" strokeWidth="1.3" /></>,
  help: <><circle cx="8" cy="8" r="6.5" fill="#3a6fd1" stroke="#1d3d80" /><path d="M6 6.2a2 2 0 1 1 2.8 1.8c-.6.3-.8.6-.8 1.3" fill="none" stroke="#fff" strokeWidth="1.6" /><circle cx="8" cy="11.6" r="1" fill="#fff" /></>,
};

export const Pic = ({ id }: { id: string }) => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{PICS[id]}</svg>;
