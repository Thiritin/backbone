import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { yearOf } from "../../../../../../sim/00-core/time";
import { licenceStatus, SHOP_MACHINE } from "../../../../../../sim/60-infra/licence";
import { AdminScreen, SCREEN_LABEL } from "../shared/AdminScreen";
import { screenArgs, screenOf, type Screen, type ScreenName } from "../shared/nav";
import type { SkinProps } from "../skins";
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

const MENUS: [string, ScreenName[]][] = [
  ["shop-admin.home", ["home"]],
  ["shop-admin.menuClients", ["clients"]],
  ["shop-admin.menuOrders", ["orders"]],
  ["shop-admin.menuBilling", ["invoices"]],
  ["shop-admin.menuSetup", ["products", "options", "servers"]],
  ["shop-admin.menuHelp", ["licence", "updates"]],
];

const label = (n: ScreenName) => (n === "products" ? t("shop-admin.productsServices") : SCREEN_LABEL[n] ?? n);

// Stroke icons of the flat sidebar on a 16 px grid.
const ICON: Partial<Record<ScreenName, string>> = {
  home: "M2 8l6-5 6 5M4 7v6h8V7",
  clients: "M8 8a3 3 0 100-6 3 3 0 000 6zM2 14c1-3 3-4 6-4s5 1 6 4",
  orders: "M3 3h10v10H3zM5 6h6M5 9h6M5 12h3",
  invoices: "M4 2h8v12l-2-1-2 1-2-1-2 1zM6 5h4M6 8h4",
  products: "M2 5l6-3 6 3-6 3zM2 5v6l6 3 6-3V5",
  options: "M3 4h10M3 8h10M3 12h10M6 2v4M10 6v4M5 10v4",
  servers: "M2 3h12v4H2zM2 9h12v4H2zM4 5h1M4 11h1",
  licence: "M5 9a3 3 0 113-3l5 5v2h-2v-1H9v-1",
  updates: "M13 8a5 5 0 11-2-4M13 2v3h-3",
};
const Icon = ({ n }: { n: ScreenName }) => <svg className="whc-ico" viewBox="0 0 16 16" aria-hidden="true"><path d={ICON[n]} /></svg>;

const link = (on: () => void) => (e: { preventDefault: () => void }) => { e.preventDefault(); on(); };
const current = (s: Screen): ScreenName => (s.name === "product" ? "products" : s.name === "client" ? "clients" : s.name);

export function Wordmark({ go }: { go?: () => void }) {
  const mark = <><b>WHM</b><span>Cache</span></>;
  return go ? <a href="#" className="whc-mark" onClick={link(go)}>{mark}</a> : <span className="whc-mark">{mark}</span>;
}

type Nav = (n: ScreenName) => void;

// The admin frame of each look; without nav it frames the licence-locked screen.
export function AdminFrame({ game, variant, major, nav, on, children }: SkinProps & { nav?: Nav; on: ScreenName; children: ReactNode }) {
  const look = lookOf(major), home = nav && (() => nav("home")), title = label(on);
  if (look === "flat") {
    return (
      <div className="portal whc whc-admin whc-flat">
        <aside className="whc-side">
          <Wordmark go={home} />
          {nav && <SideNav nav={nav} on={on} />}
        </aside>
        <div className="whc-col">
          <header className="whc-top"><h1>{title}</h1><span className="whc-avatar" title={t("shop-admin.welcome", { name: "admin" })}>A</span></header>
          <main className="whc-main">{children}</main>
          <VersionFooter game={game} variant={variant} />
        </div>
      </div>
    );
  }
  return (
    <div className={`portal whc whc-admin whc-${look}`}>
      <header className="whc-head">
        <Wordmark go={home} />
        <span className="whc-user">{t("shop-admin.welcome", { name: "admin" })}</span>
      </header>
      {nav && <MenuBar nav={nav} on={on} />}
      <div className="whc-body">
        {look === "classic" && nav && <Sidebar game={game} variant={variant} nav={nav} />}
        <main className="whc-main">
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
      {MENUS.map(([key, items]) => (
        <div key={key} className={`whc-drop${items.includes(on) ? " on" : ""}`}>
          <a href="#" onClick={link(() => nav(items[0]))}>{t(key)}</a>
          {items.length > 1 && <div className="whc-sub">{items.map((n) => <a key={n} href="#" onClick={link(() => nav(n))}>{label(n)}</a>)}</div>}
        </div>
      ))}
    </nav>
  );
}

function SideNav({ nav, on }: { nav: Nav; on: ScreenName }) {
  return (
    <nav className="whc-sidenav">
      {MENUS.map(([key, items]) => (
        <div key={key}>
          {items.length > 1 && <h4>{t(key)}</h4>}
          {items.map((n) => <a key={n} href="#" className={n === on ? "on" : ""} onClick={link(() => nav(n))}><Icon n={n} />{label(n)}</a>)}
        </div>
      ))}
    </nav>
  );
}

// The left column of the bevelled admin: shortcuts and the system box.
function Sidebar({ game, variant, nav }: Pick<SkinProps, "game" | "variant"> & { nav: Nav }) {
  const pending = game.tickets.filter((x) => x.kind === "order" && x.status === "open").length;
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
    <AdminFrame {...props} nav={(n) => go({ name: n })} on={on}>
      <div className={`whc-s-${on}`}>
        <AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} browse={browse} />
      </div>
    </AdminFrame>
  );
}

// The sign-in page of each look.
export function WhmCacheLogin({ game, major, onLogin }: SkinProps & { onLogin: () => void }) {
  const look = lookOf(major);
  return (
    <div className={`portal whc whc-login whc-${look}`}>
      {look === "flat" && <div className="whc-login-art"><Wordmark /></div>}
      <form className="whc-login-box" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
        {look === "flat" ? <h1>{t("shop-whmCache.adminLogin")}</h1> : <div className="whc-login-head"><Wordmark /></div>}
        {look === "classic" && <h2>{t("shop-whmCache.adminLogin")}</h2>}
        <label>{t("shop-admin.username")}<input name="username" defaultValue="admin" autoComplete="off" /></label>
        <label>{t("shop-admin.password")}<input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
        <button type="submit" className="btn primary">{t("shop-admin.login")}</button>
        <small className="num">{t("shop-admin.footer", { name: "WHMCache", version: game.shop.install?.version ?? "" })}</small>
      </form>
    </div>
  );
}
