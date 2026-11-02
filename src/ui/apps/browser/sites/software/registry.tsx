import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { eraOf } from "../era";
import { Cpanic } from "./cpanic";
import { DirectAdmen } from "./directadmen";
import { FreePanel } from "./freepanel";
import { HyperVee } from "./hypervee";
import { Lunix } from "./lunix";
import { MultiKraft } from "./multikraft";
import { OpenStash } from "./openstash";
import { OpenVeeZee } from "./openveezee";
import { Pleskit } from "./pleskit";
import { Proxmocks } from "./proxmocks";
import { Pterodaktyl } from "./pterodaktyl";
import { TCAdmen } from "./tcadmen";
import { VMwhere } from "./vmwhere";
import { Windoors } from "./windoors";
import { AnyConnekt } from "./anyconnekt";
import { Bound } from "./bound";
import { KnutDns } from "./knut";
import { Mailpig } from "./mailpig";
import { MinnIO } from "./minnio";
import { OpenVeePeeN } from "./openveepeen";
import { OwnClod } from "./ownclod";
import { Postfixit } from "./postfixit";
import { PostfixitAdminSite, SquirrelMealSite } from "./squirrelmeal";
import { PowerDNZ } from "./powerdnz";
import { VsFTPeed } from "./vsftpeed";
import { WireGuarded } from "./wireguarded";
import { pageOf, PlainSite, productOf, type SiteComponent } from "./SoftwareSite";

// Every software and OS site with a design of its own; the rest render the plain site.
export const SITE_VIEWS: Record<string, SiteComponent> = {
  lunix: Lunix, windoors: Windoors,
  openveezee: OpenVeeZee, openstash: OpenStash, vmwhere: VMwhere, proxmocks: Proxmocks, hypervee: HyperVee,
  cpanic: Cpanic, pleskit: Pleskit, directadmen: DirectAdmen, freepanel: FreePanel,
  tcadmen: TCAdmen, multikraft: MultiKraft, pterodaktyl: Pterodaktyl,
  bound: Bound, powerdnz: PowerDNZ, knut: KnutDns, openveepeen: OpenVeePeeN, anyconnekt: AnyConnekt, wireguarded: WireGuarded,
  vsftpeed: VsFTPeed, ownclod: OwnClod, minnio: MinnIO, postfixit: Postfixit, mailpig: Mailpig, squirrelmeal: SquirrelMealSite, postfixitadmin: PostfixitAdminSite,
};

export function SoftwarePage({ game, kind, id, path, go }: { game: GameState; kind: "software" | "os"; id: string; path: string; go: (url: string) => void }) {
  const p = productOf(kind, id);
  if (!p) return null;
  const year = yearOf(game.hour), View = SITE_VIEWS[id] ?? PlainSite;
  return <View p={p} look={eraOf(p.site.eras, year)} page={pageOf(path)} year={year} hour={game.hour} go={(to) => go(`${displayHost(p.site.host)}${to}`)} />;
}
