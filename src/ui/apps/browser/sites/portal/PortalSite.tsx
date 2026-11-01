import { useEffect, type ReactNode } from "react";
import { shopById, type ShopId } from "../../../../../sim/10-catalog/shops";
import { versionInfo } from "../../../../../sim/10-catalog/software-versions";
import { shopBlock } from "../../../../../sim/80-business/website";
import { LicenceScreen, licenceLocked, NotTakingOrders, VersionFooter } from "./shared/Licence";
import type { GameState } from "../../../../../sim/50-state";
import { isAdminAlias, parsePortal, portalPath, type PortalRoute } from "../../../../../sim/80-business/portal";
import { useSessionState } from "../../../../session";
import { Login } from "./Login";
import { skinOf, type Open } from "./skins";

// The hosted shop of the company: store front, client area and admin of the chosen shop system.
export function PortalSite({ game, host, path, go }: { game: GameState; host: string; path: string; go: (url: string) => void }) {
  const variant = game.shop.variant;
  const [loggedIn, setLoggedIn] = useSessionState("portal.admin", false);
  const route: PortalRoute = (variant && parsePortal(variant, path)) || { area: "store", query: new URLSearchParams() };
  const alias = !!variant && isAdminAlias(path) && route.area !== "admin";
  useEffect(() => { if (variant && alias) go(host + portalPath(variant, "admin")); }, [alias, variant, host]);
  if (!variant) return null;
  const skin = skinOf(variant);
  const open: Open = (area, ids, screen) => go(host + portalPath(variant, area, ids, screen));
  const version = game.shop.install?.version ?? "", major = versionInfo(variant, version)?.major ?? "";
  const Frame = skin.Bare ?? Bare;
  const props = { game, variant, route: alias ? { ...route, area: "admin" as const } : route, open, version, major, browse: go };
  if (route.area === "admin" || alias) {
    if (!loggedIn) return skin.Login ? <skin.Login {...props} onLogin={() => setLoggedIn(true)} /> : <Login variant={variant} onLogin={() => setLoggedIn(true)} />;
    return licenceLocked(game) ? <Frame {...props}><LicenceScreen game={game} /></Frame> : <skin.Admin {...props} />;
  }
  if (shopBlock(game)) return <Frame {...props}><NotTakingOrders game={game} /></Frame>;
  if (route.area === "client") return <skin.Client {...props} />;
  return <skin.Store {...props} />;
}

// The shared screens a shop shows on their own: the licence while it ran out, and the closed store.
function Bare({ game, variant, children }: { game: GameState; variant: ShopId; children: ReactNode }) {
  return (
    <div className="portal portal-plain">
      <header><h1>{shopById(variant).name}</h1></header>
      <main>{children}</main>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}
