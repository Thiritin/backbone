import { useEffect } from "react";
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
  const props = { game, variant, route: alias ? { ...route, area: "admin" as const } : route, open };
  if (route.area === "admin" || alias) return loggedIn ? <skin.Admin {...props} /> : <Login variant={variant} onLogin={() => setLoggedIn(true)} />;
  if (route.area === "client") return <skin.Client {...props} />;
  return <skin.Store {...props} />;
}
