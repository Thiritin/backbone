import { pendingOrders } from "../../../../../../sim/80-business/shop-orders";
import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { yearOf } from "../../../../../../sim/00-core/time";
import { licenceStatus, SHOP_MACHINE } from "../../../../../../sim/60-infra/licence";
import { adminFirstName } from "../../../../../../sim/60-infra/shop-files";
import { AdminScreen, SCREEN_LABEL, titleOf } from "../shared/AdminScreen";
import { navOf, screenArgs, screenOf, type Screen, type ScreenName } from "../shared/nav";
import type { LoginProps, SkinProps } from "../skins";
import { LoginNote } from "../Login";
import { VersionFooter } from "../shared/Licence";
import "../portal.css";
import "./skin.css";

// The game-year era other shop skins still read through makeSkin.
export const eraOf = (hour: number): "early" | "mid" | "late" => (yearOf(hour) <= 2011 ? "early" : yearOf(hour) <= 2019 ? "mid" : "late");

// The look of an installed major: the bevelled admin of 2 to 4, the glossy one of 5 to 7, the flat one from 8.
export type WhcLook = "classic" | "gloss" | "flat";
export const lookOf = (major: string): WhcLook => {
  const n = parseInt(major, 10) || 0;
  return n >= 8 ? "flat" : n >= 5 ? "gloss" : "classic";
};

// Every top item as the real admin lists it; one without a screen of its own opens the nearest one.
const MENUS: [string, ScreenName, ScreenName[]][] = [
  ["shop-admin.home", "home", []],
  ["shop-admin.menuClients", "clients", ["clients", "accounts", "domains"]],
  ["shop-admin.menuOrders", "orders", ["orders"]],
  ["shop-admin.menuBilling", "invoices", ["invoices", "quotes"]],
  ["shop-whmCache.menuSupport", "emails", ["emails"]],
  ["shop-whmCache.menuReports", "reports", []],
  ["shop-whmCache.menuTools", "import", ["import", "updates"]],
  ["shop-admin.menuSetup", "products", ["products", "servers", "settings", "gateways", "marketplace"]],
  ["shop-admin.menuHelp", "licence", ["licence"]],
];

const LABEL: Partial<Record<ScreenName, string>> = {
  gateways: t("shop-market.gateways"), import: t("shop-admin.d.import"), accounts: t("shop-admin.d.accounts"), domains: t("shop-admin.d.domains"), reports: t("shop-admin.d.reports"),
};
const label = (n: ScreenName) => (n === "products" ? t("shop-admin.productsServices") : LABEL[n] ?? SCREEN_LABEL[n] ?? n);

const link = (on: () => void) => (e: { preventDefault: () => void }) => { e.preventDefault(); on(); };
const current = (s: Screen): ScreenName => (s.name === "import" || s.name === "gateways" ? s.name : navOf(s.name));

export function Wordmark({ go }: { go?: () => void }) {
  const mark = <><b>WHM</b><span>Cache</span></>;
  return go ? <a href="#" className="whc-mark" onClick={link(go)}>{mark}</a> : <span className="whc-mark">{mark}</span>;
}

type Nav = (n: ScreenName) => void;

// The admin frame of each look; without nav it frames the licence-locked screen.
export function AdminFrame({ game, variant, major, nav, on, title: heading, children }: SkinProps & { nav?: Nav; on: ScreenName; title?: string; children: ReactNode }) {
  const look = lookOf(major), home = nav && (() => nav("home")), title = heading ?? label(on);
  if (look === "flat") {
    return (
      <div className="portal whc whc-admin whc-flat">
        <header className="whc-top">
          <Wordmark go={home} />
          {nav && <MenuBar nav={nav} on={on} />}
          <span className="whc-avatar" title={t("shop-admin.welcome", { name: adminFirstName(game) ?? "admin" })}>A</span>
        </header>
        <main className="whc-main"><h1 className="whc-title">{title}</h1>{children}</main>
        <VersionFooter game={game} variant={variant} />
      </div>
    );
  }
  return (
    <div className={`portal whc whc-admin whc-${look}`}>
      <header className="whc-head">
        <Wordmark go={home} />
        <span className="whc-user">{t("shop-admin.welcome", { name: adminFirstName(game) ?? "admin" })}</span>
      </header>
      {nav && <MenuBar nav={nav} on={on} />}
      <div className="whc-body">
        {look === "classic" && nav && <Sidebar game={game} variant={variant} nav={nav} />}
        <main className={`whc-main${on === "home" ? " whc-home" : ""}`}>
          <h1 className="whc-title">{title}</h1>
          <div className="whc-panel">{children}</div>
        </main>
      </div>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

// Menu bar with a drop-down per group, as the bevelled and glossy admins had.
function MenuBar({ nav, on }: { nav: Nav; on: ScreenName }) {
  return (
    <nav className="whc-menu">
      {MENUS.map(([key, to, items]) => (
        <div key={key} className={`whc-drop${(items.length ? items.includes(on) : to === on) ? " on" : ""}`}>
          <a href="#" onClick={link(() => nav(to))}>{t(key)}</a>
          {items.length > 0 && <div className="whc-sub">{items.map((n) => <a key={n} href="#" onClick={link(() => nav(n))}>{label(n)}</a>)}</div>}
        </div>
      ))}
    </nav>
  );
}

// The left column of the bevelled admin: shortcuts and the system box.
function Sidebar({ game, variant, nav }: Pick<SkinProps, "game" | "variant"> & { nav: Nav }) {
  const pending = pendingOrders(game);
  const status = licenceStatus(game, SHOP_MACHINE, variant);
  return (
    <aside className="whc-sidebar">
      <section>
        <h3>{t("shop-whmCache.shortcuts")}</h3>
        <a href="#" onClick={link(() => nav("orders"))}>{SCREEN_LABEL.orders} ({pending})</a>
        <a href="#" onClick={link(() => nav("products"))}>{t("shop-admin.createProduct")}</a>
        <a href="#" onClick={link(() => nav("updates"))}>{SCREEN_LABEL.updates}</a>
      </section>
      <section>
        <h3>{t("shop-whmCache.systemInfo")}</h3>
        <dl>
          <dt>{t("shop-whmCache.version")}</dt><dd className="num">{game.shop.install?.version}</dd>
          <dt>{t("shop-whmCache.registeredTo")}</dt><dd>{game.company.name}</dd>
          <dt>{t("shop-admin.licence")}</dt><dd>{t(`shop-admin.licence_${status ?? "active"}`)}</dd>
        </dl>
      </section>
    </aside>
  );
}

export function WhmCacheAdmin(props: SkinProps) {
  const { game, route, open, browse } = props, screen = screenOf(route.query), on = current(screen);
  const go = (s: Screen) => open("admin", {}, screenArgs(s));
  return (
    <AdminFrame {...props} nav={(n) => go({ name: n })} on={on} title={titleOf(screen)}>
      <div className={`whc-s-${on}`}>
        <AdminScreen game={game} screen={screen} go={go} wizard={(parseInt(props.major, 10) || 0) >= 7} dash="whmcs" label={label} toClient={(c) => open("client", {}, { c })} browse={browse} />
      </div>
    </AdminFrame>
  );
}

// The sign-in page of each look.
export function WhmCacheLogin({ game, major, onLogin, error, onForgot }: SkinProps & LoginProps) {
  const look = lookOf(major);
  return (
    <div className={`portal whc whc-login whc-${look}`}>
      {look === "flat" && <div className="whc-login-art"><Wordmark /></div>}
      <form className="whc-login-box" onSubmit={(e) => { e.preventDefault(); onLogin(e.currentTarget); }}>
        {look === "flat" ? <h1>{t("shop-whmCache.adminLogin")}</h1> : <div className="whc-login-head"><Wordmark /></div>}
        {look === "classic" && <h2>{t("shop-whmCache.adminLogin")}</h2>}
        <label>{t("shop-admin.username")}<input name="username" autoComplete="off" /></label>
        <label>{t("shop-admin.password")}<input name="password" type="password" autoComplete="off" /></label>
        <button type="submit" className="pt-btn primary">{t("shop-admin.login")}</button>
        <small className="num">{t("shop-admin.footer", { name: "WHMCache", version: game.shop.install?.version ?? "" })}</small>
        <LoginNote error={error} onForgot={onForgot} />
      </form>
    </div>
  );
}
