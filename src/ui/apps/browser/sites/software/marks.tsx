import type { ReactNode } from "react";

// The colour each software and OS site is drawn in; its favicon and wordmark use it.
export const SITE_COLOR: Record<string, string> = {
  lunix: "#d70a53", windoors: "#0a6fc2",
  openveezee: "#1f8a9e", openstash: "#da1a32", vmwhere: "#3a6ea5", proxmocks: "#e57000", hypervee: "#0063b1",
  cpanic: "#ff6c2c", pleskit: "#53bce6", directadmen: "#2f6f2f", freepanel: "#3c8d3c",
  tcadmen: "#7ac142", multikraft: "#6b4a2b", pterodaktyl: "#0e4688",
  bound: "#1b4f8a", powerdnz: "#f07d00", knut: "#c3202f", openveepeen: "#ea7e20", anyconnekt: "#005073", wireguarded: "#88171a",
  vsftpeed: "#444444", ownclod: "#1d63ad", minnio: "#c72c48", postfixit: "#555555", mailpig: "#f0569a",
};

const W = { stroke: "white", strokeWidth: 1.5, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const letter = (t: string, size = 8.5) => <text x="8" y="11.2" textAnchor="middle" fontSize={size} fontWeight="800" fill="white" fontFamily="Verdana, Arial, sans-serif">{t}</text>;

const GLYPH: Record<string, ReactNode> = {
  lunix: <path d="M10.6 6.2a3.2 3.2 0 1 0 .3 3.9M10.6 6.2c-.9-1-2.7-1-3.3.3-.6 1.3.5 2.6 1.7 2.2" {...W} />,
  windoors: <g fill="white"><rect x="3.5" y="3.5" width="4.1" height="4.1" /><rect x="8.4" y="3.5" width="4.1" height="4.1" /><rect x="3.5" y="8.4" width="4.1" height="4.1" /><rect x="8.4" y="8.4" width="4.1" height="4.1" /></g>,
  openveezee: <g fill="white"><rect x="4" y="3.5" width="8" height="2.4" rx="0.6" /><rect x="4" y="6.8" width="8" height="2.4" rx="0.6" opacity="0.8" /><rect x="4" y="10.1" width="8" height="2.4" rx="0.6" opacity="0.6" /></g>,
  openstash: <path d="M8 3.5l4.5 2.2L8 7.9 3.5 5.7zM3.5 8.2L8 10.4l4.5-2.2M3.5 10.5L8 12.7l4.5-2.2" {...W} />,
  vmwhere: <g {...W}><rect x="3.5" y="3.5" width="6" height="6" /><rect x="6.5" y="6.5" width="6" height="6" /></g>,
  proxmocks: <path d="M3.8 4l4.2 4-4.2 4M12.2 4L8 8l4.2 4" {...W} strokeWidth={1.8} />,
  hypervee: <g {...W}><rect x="3" y="4" width="10" height="8" rx="1" /><path d="M5.5 7h2M5.5 9.5h5" /></g>,
  cpanic: letter("cP"),
  pleskit: <g {...W}><circle cx="8" cy="8" r="4.3" /><path d="M6.6 10.6V5.6h1.9a1.5 1.5 0 0 1 0 3H6.6" /></g>,
  directadmen: letter("DA", 7.5),
  freepanel: <path d="M4 12c0-5 3-8 8-8 0 5-3 8-8 8zM4 12l5-5" {...W} />,
  tcadmen: letter("TC", 7.5),
  multikraft: <g stroke="white" strokeWidth="1.2" strokeLinejoin="round"><path d="M8 3.5l4.5 2.3L8 8.1 3.5 5.8z" fill="#8bc34a" /><path d="M3.5 5.8v4.6L8 12.7V8.1z" fill="none" /><path d="M12.5 5.8v4.6L8 12.7V8.1z" fill="none" /></g>,
  pterodaktyl: <path d="M2.8 9.5L8 5l5.2 4.5M5.4 9.5L8 7.3l2.6 2.2" {...W} />,
};

// A code-drawn mark: the glyph on a tile of the site's colour, or the first letter for a site without one.
export function SiteMark({ id, name, size = 16, color }: { id: string; name: string; size?: number; color?: string }) {
  return (
    <svg className="fav" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx={id === "windoors" || id === "multikraft" ? 1.5 : 3.5} fill={color ?? SITE_COLOR[id] ?? "#5a6270"} />
      {GLYPH[id] ?? letter(name[0]?.toUpperCase() ?? "?", 9.5)}
    </svg>
  );
}
