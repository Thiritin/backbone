import type { ReactNode } from "react";
import { shopById } from "../../../sim/10-catalog/shops";
import type { Resolved } from "../../../sim/80-business/browser";
import type { GameState } from "../../../sim/50-state";
import { customerSite } from "../../../sim/80-business/website";
import { Logo } from "../../art/logos";
import { familyOf } from "../../../sim/60-infra/vulns";
import { consoleLook } from "../../../sim/80-business/consoles";
import { BRAND } from "../products/parts";
import { BMC_LOOK } from "./ipmi/IpmiPage";
import { REGISTRAR_HUE } from "./sites/registrars/RegistrarPage";
import { SiteMark } from "./sites/software/marks";
import { softwareById } from "../../../sim/10-catalog/platforms";
import { serverOsById } from "../../../sim/10-catalog/server-os";

const GREY = "oklch(0.62 0.01 255)";

// A deterministic hue from a name, so a customer's letter keeps its colour.
const hueOf = (name: string): number => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const Tile = ({ fill, children }: { fill: string; children: ReactNode }) => (
  <svg className="fav" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1" y="1" width="14" height="14" rx="3.5" fill={fill} />
    {children}
  </svg>
);

// A 16 px mark per kind of page: the company colour for its site, a letter for a customer, the brand's mark for a vendor.
export function Favicon({ game, r }: { game: GameState; r: Resolved }) {
  if (r.load === "down") return <Tile fill={GREY}><path d="M5 5l6 6M11 5l-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" /></Tile>;
  const p = r.page;
  switch (p.kind) {
    case "company":
      return <Tile fill={game.company.color}><circle cx="8" cy="8" r="3.6" fill="none" stroke="white" strokeWidth="1.2" /><path d="M4.4 8h7.2M8 4.4c-2 2-2 5.2 0 7.2M8 4.4c2 2 2 5.2 0 7.2" fill="none" stroke="white" strokeWidth="1" /></Tile>;
    case "customer": {
      const title = customerSite(game, p.serviceId)?.title ?? "?";
      return (
        <svg className="fav" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1" y="1" width="14" height="14" rx="3.5" fill={`oklch(0.58 0.13 ${hueOf(title)})`} />
          <text x="8" y="11.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">{title[0]?.toUpperCase()}</text>
        </svg>
      );
    }
    case "office": return <Tile fill="#1c3f8c"><path d="M8 3.2l4.6 2.3H3.4zM4.4 6.6h1.4v4.2H4.4zM7.3 6.6h1.4v4.2H7.3zM10.2 6.6h1.4v4.2h-1.4zM3.4 11.6h9.2v1.3H3.4z" fill="white" /></Tile>;
    case "lexwear": return <Tile fill="#c8102e"><text x="8" y="11.8" textAnchor="middle" fontSize="10" fontWeight="800" fill="white" fontFamily="Verdana, sans-serif">L</text></Tile>;
    case "shopVendor": {
      const name = shopById(p.id).name;
      return <Tile fill={`oklch(0.5 0.12 ${hueOf(name)})`}><text x="8" y="11.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white" fontFamily="Verdana, sans-serif">{name[0]}</text></Tile>;
    }
    case "wiki": return <Tile fill="#f8f9fa"><text x="8" y="12" textAnchor="middle" fontSize="11" fontFamily="Georgia, serif" fill="#202122">W</text></Tile>;
    case "sponsorboard": return <Tile fill="oklch(0.66 0.17 55)"><path d="M3.5 5h9v4.5h-4L6 12V9.5H3.5z" fill="white" /></Tile>;
    case "vendor": return <Logo provider={p.maker} size={16} />;
    case "index": return <Tile fill="#6b0fb3"><text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="900" fontStyle="italic" fill="white" fontFamily="Georgia, serif">Y!</text></Tile>;
    case "software": return <SiteMark id={p.id} name={softwareById(p.id).name} />;
    case "os": return <SiteMark id={p.id} name={serverOsById(p.id).name} />;
    case "registrar": return <Tile fill={`oklch(0.55 0.15 ${REGISTRAR_HUE[p.id]})`}><text x="8" y="11.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">{p.id[0].toUpperCase()}</text></Tile>;
    case "host": return <Tile fill="oklch(0.38 0.01 255)"><rect x="3.5" y="3.5" width="9" height="3" rx="0.8" fill="white" /><rect x="3.5" y="8.5" width="9" height="3" rx="0.8" fill="white" opacity="0.7" /></Tile>;
    case "console": {
      const c = game.clusters.find((x) => x.id === p.clusterId), family = c && familyOf(c), look = family ? consoleLook(family) : "game";
      const fill = look === "game" ? "oklch(0.5 0.14 150)" : BRAND[family ?? "proxmocks"]?.color ?? GREY;
      return <Tile fill={p.defaced ? "oklch(0.25 0.01 255)" : fill}><path d="M4.5 5h7M4.5 8h7M4.5 11h4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></Tile>;
    }
    case "ipmi": {
      const brand = game.devices.find((x) => x.id === p.deviceId)?.brand ?? "";
      return <Tile fill={BMC_LOOK[brand]?.color ?? GREY}><rect x="3.5" y="5" width="9" height="6" rx="1" fill="none" stroke="white" strokeWidth="1.3" /><path d="M5.5 8h2" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></Tile>;
    }
    case "kvm": return <Tile fill="#555555"><rect x="3.5" y="4.5" width="9" height="6" rx="1" fill="none" stroke="white" strokeWidth="1.3" /><path d="M6.5 12.5h3" stroke="white" strokeWidth="1.3" strokeLinecap="round" /></Tile>;
    case "video": return <Tile fill="oklch(0.58 0.22 27)"><path d="M6.4 5.2v5.6L11 8z" fill="white" /></Tile>;
    default: return <Tile fill={GREY}><path d="M6 6.4a2 2 0 1 1 2.6 1.9c-.5.2-.6.5-.6 1M8 11.4v.2" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></Tile>;
  }
}
