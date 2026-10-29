import type { ReactNode } from "react";
import type { Resolved } from "../../../sim/80-business/browser";
import type { GameState } from "../../../sim/50-state";
import { customerSite } from "../../../sim/80-business/website";
import { Logo } from "../../art/logos";
import { familyOf } from "../../../sim/60-infra/vulns";
import { consoleLook } from "../../../sim/80-business/consoles";
import { BRAND } from "../products/parts";

const GREY = "oklch(0.62 0.01 255)";

// A deterministic hue from a name, so a customer's letter keeps its colour.
const hueOf = (name: string): number => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const Tile = ({ fill, children }: { fill: string; children: ReactNode }) => (
  <svg className="fav" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1" y="1" width="14" height="14" rx="3.5" fill={fill} />
    {children}
  </svg>
);

// A 16 px mark per kind of page: the company colour for its site and Admin, a letter for a customer, the brand's mark for a vendor.
export function Favicon({ game, r }: { game: GameState; r: Resolved }) {
  if (r.load === "down") return <Tile fill={GREY}><path d="M5 5l6 6M11 5l-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" /></Tile>;
  const p = r.page;
  switch (p.kind) {
    case "company":
      return <Tile fill={game.company.color}><circle cx="8" cy="8" r="3.6" fill="none" stroke="white" strokeWidth="1.2" /><path d="M4.4 8h7.2M8 4.4c-2 2-2 5.2 0 7.2M8 4.4c2 2 2 5.2 0 7.2" fill="none" stroke="white" strokeWidth="1" /></Tile>;
    case "admin":
      return <Tile fill={game.company.color}><path d="M4 5.5h8M4 8h8M4 10.5h8" stroke="white" strokeWidth="1.4" strokeLinecap="round" /><circle cx="6" cy="5.5" r="1.3" fill="white" /><circle cx="10" cy="8" r="1.3" fill="white" /><circle cx="7" cy="10.5" r="1.3" fill="white" /></Tile>;
    case "customer": {
      const title = customerSite(game, p.serviceId)?.title ?? "?";
      return (
        <svg className="fav" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1" y="1" width="14" height="14" rx="3.5" fill={`oklch(0.58 0.13 ${hueOf(title)})`} />
          <text x="8" y="11.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">{title[0]?.toUpperCase()}</text>
        </svg>
      );
    }
    case "vendor": return <Logo provider={p.maker} size={16} />;
    case "host": return <Tile fill="oklch(0.38 0.01 255)"><rect x="3.5" y="3.5" width="9" height="3" rx="0.8" fill="white" /><rect x="3.5" y="8.5" width="9" height="3" rx="0.8" fill="white" opacity="0.7" /></Tile>;
    case "console": {
      const c = game.clusters.find((x) => x.id === p.clusterId), family = c && familyOf(c), look = family ? consoleLook(family) : "game";
      const fill = look === "game" ? "oklch(0.5 0.14 150)" : BRAND[family ?? "proxmocks"]?.color ?? GREY;
      return <Tile fill={p.defaced ? "oklch(0.25 0.01 255)" : fill}><path d="M4.5 5h7M4.5 8h7M4.5 11h4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></Tile>;
    }
    case "video": return <Tile fill="oklch(0.58 0.22 27)"><path d="M6.4 5.2v5.6L11 8z" fill="white" /></Tile>;
    default: return <Tile fill={GREY}><path d="M6 6.4a2 2 0 1 1 2.6 1.9c-.5.2-.6.5-.6 1M8 11.4v.2" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></Tile>;
  }
}
