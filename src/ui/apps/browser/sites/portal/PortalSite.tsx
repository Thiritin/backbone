import { useEffect, useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { INSTALL_DIR_BLOCKS, installDirLeft, shopSpace } from "../../../../../sim/60-infra/shop-files";
import { shopLogin } from "../../../../../sim/90-actions/shop-setup";
import { useStore } from "../../../../store";
import { ForgotForm, InstallDirBlock, ResetForm } from "./setup/AdminGate";
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
  const variant = game.shop.variant, attempt = useStore((x) => x.attempt), at = game.shop.install;
  // A new install asks for its new admin account.
  const [loggedIn, setLoggedIn] = useSessionState(`portal.admin.${at?.ws ?? ""}.${at?.at ?? 0}`, false);
  const [error, setError] = useState<string | undefined>(), [forgot, setForgot] = useState(false);
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
    // Logged out, the shop shows its gate pages without the admin area around them.
    const left = installDirLeft(game), token = route.query.get("reset");
    if (left && INSTALL_DIR_BLOCKS.includes(variant)) return <Bare {...props}><InstallDirBlock name={shopById(variant).name} /></Bare>;
    const toLogin = () => { setForgot(false); go(host + portalPath(variant, "admin")); };
    if (token && !loggedIn) return <Bare {...props}><ResetForm token={token} onBack={toLogin} /></Bare>;
    if (!loggedIn && forgot) return <Bare {...props}><ForgotForm onBack={toLogin} /></Bare>;
    if (!loggedIn) {
      const onLogin = (form: HTMLFormElement | null) => {
        const d = form && new FormData(form), r = attempt(shopLogin, String(d?.get("username") ?? ""), String(d?.get("password") ?? ""));
        setError(r.ok ? undefined : t(r.error));
        if (r.ok) setLoggedIn(true);
      };
      const gate = { onLogin, error, onForgot: shopSpace(game) ? () => setForgot(true) : undefined };
      return skin.Login ? <skin.Login {...props} {...gate} /> : <Login variant={variant} {...gate} />;
    }
    const warn = left && <p className="portal-warn" role="alert">{t("shop-setup.installDir.warn")}</p>;
    return licenceLocked(game) ? <Frame {...props}>{warn}<LicenceScreen game={game} /></Frame> : <>{warn}<skin.Admin {...props} /></>;
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
