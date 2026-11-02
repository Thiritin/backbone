import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { versionAt } from "../../../../../../sim/10-catalog/software-versions";
import { AdminScreen, SCREEN_LABEL } from "../shared/AdminScreen";
import { ClientArea } from "../shared/ClientArea";
import { VersionFooter } from "../shared/Licence";
import { screenArgs, screenOf, type Screen, type ScreenName, type ScreenProps } from "../shared/nav";
import { StoreFront } from "../shared/StoreFront";
import type { Skin, SkinProps } from "../skins";
import "../portal.css";
import "./skin.css";

// ClientExit's looks by installed major: 2.x and 3.x table layouts with bevelled tabs, 4.x glossy desktop panels,
// 5.x and 6.x a flat dark sidebar, 7.x the refreshed light console.
export type Look = "classic" | "desk" | "flat" | "seven";
export const lookOf = (major: string, hour: number): Look => {
  const m = Number(major || versionAt("clientExit", hour).major);
  return m >= 7 ? "seven" : m >= 5 ? "flat" : m === 4 ? "desk" : "classic";
};

type Nav = Exclude<ScreenName, "product" | "client">;
const ICON: Record<Nav, string> = {
  home: "M2 8 8 2l6 6M4 7v7h8V7",
  clients: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 15c0-3 3-5 6-5s6 2 6 5",
  orders: "M1 2h2l2 9h8l2-6H4M6 14h1M12 14h1",
  invoices: "M3 1h7l3 3v11H3zM6 6h4M6 9h4M6 12h2",
  products: "M8 1l7 3.5v7L8 15l-7-3.5v-7zM1 4.5 8 8l7-3.5M8 8v7",
  options: "M2 4h12M2 8h12M2 12h12M5 2v4M11 6v4M7 10v4",
  servers: "M2 2h12v5H2zM2 9h12v5H2zM4 4.5h2M4 11.5h2",
  licence: "M2 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM8 8h7M13 8v3M11 8v2",
  updates: "M14 8a6 6 0 1 1-2-4.5M14 2v4h-4",
};
const Icon = ({ n }: { n: Nav }) => <svg className="cxe-ico" viewBox="0 0 16 16" aria-hidden="true"><path d={ICON[n]} /></svg>;

const GROUPS: [string, Nav[]][] = [["", ["home"]], ["sales", ["orders", "clients", "invoices"]], ["catalog", ["products", "options", "servers"]], ["system", ["licence", "updates"]]];
const label = (n: Nav): string => (n === "products" ? t("shop-store.lblGroups") : SCREEN_LABEL[n]!);

// The wordmark: the second word sits on an exit sign.
export const Mark = () => <span className="cxe-mark">Client<span className="cxe-exit">Exit<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5h6M5 2l3 3-3 3" /></svg></span></span>;

const pick = (e: { preventDefault: () => void }, f: () => void) => { e.preventDefault(); f(); };

function AdminFrame({ game, variant, major, nav, title, children }: SkinProps & { nav?: ReactNode; title?: string; children: ReactNode }) {
  return (
    <div className={`portal cxe cxe-${lookOf(major, game.hour)} cxe-admin`}>
      <header className="cxe-top"><Mark /><span className="cxe-area">{t("cexit.admin")}</span><span className="cxe-co">{game.company.name}</span></header>
      <div className="cxe-body">
        {nav}
        <main className="cxe-main">
          {title && <h1 className="cxe-title">{title}</h1>}
          <div className="cxe-panel">{children}</div>
        </main>
      </div>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

function Home({ game, go }: ScreenProps) {
  const tiles: [Nav, number][] = [
    ["orders", game.tickets.filter((x) => x.kind === "order" && x.status === "open").length],
    ["clients", game.customers.filter((c) => c.churnedAt === null).length],
    ["invoices", game.invoices.filter((i) => i.status === "open" || i.status === "overdue").length],
    ["products", game.shop.products.length],
  ];
  return (
    <div className="cxe-tiles">
      {tiles.map(([n, v]) => (
        <a key={n} href="#" className="cxe-tile" onClick={(e) => pick(e, () => go({ name: n }))}>
          <Icon n={n} /><span className="num">{v}</span>{n === "invoices" ? t("cexit.unpaid") : label(n)}
        </a>
      ))}
    </div>
  );
}

function Admin(props: SkinProps) {
  const { game, route, open, major } = props, look = lookOf(major, game.hour), screen = screenOf(route.query);
  const go = (s: Screen) => open("admin", {}, screenArgs(s));
  const current: Nav = screen.name === "product" ? "products" : screen.name === "client" ? "clients" : screen.name;
  const link = (n: Nav) => (
    <a key={n} href="#" className={current === n ? "on" : ""} onClick={(e) => pick(e, () => go({ name: n }))}>{look !== "classic" && <Icon n={n} />}{label(n)}</a>
  );
  const nav = (
    <nav className="cxe-nav">
      {look === "seven"
        ? GROUPS.map(([g, ns]) => <div key={g || "top"} className="cxe-group">{g && <h4>{t(`cexit.group.${g}`)}</h4>}{ns.map(link)}</div>)
        : GROUPS.flatMap(([, ns]) => ns).map(link)}
    </nav>
  );
  return (
    <AdminFrame {...props} nav={nav} title={label(current)}>
      {screen.name === "home" ? <Home game={game} go={go} /> : <AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} browse={props.browse} />}
    </AdminFrame>
  );
}

function StoreFrame({ game, variant, major, route, open, children }: SkinProps & { children: ReactNode }) {
  const look = lookOf(major, game.hour), groups = game.shop.productGroups.filter((g) => !g.hidden);
  const store = route.area !== "client";
  return (
    <div className={`portal cxe cxe-${look} cxe-store`}>
      <header className="cxe-top">
        <span className="cxe-brand">{game.company.name}</span>
        <nav className="cxe-links">
          <a href="#" className={store ? "on" : ""} onClick={(e) => pick(e, () => open("store"))}>{t("cexit.store")}</a>
          <a href="#" className={store ? "" : "on"} onClick={(e) => pick(e, () => open("client"))}>{t("cexit.clientArea")}</a>
        </nav>
      </header>
      {look !== "classic" && route.area === "store" && <div className="cxe-hero"><h1>{groups.find((g) => g.id === route.group)?.name ?? t("cexit.allGroups")}</h1></div>}
      <div className="cxe-body">
        {route.area === "store" && groups.length > 1 && (
          <nav className="cxe-cats">
            <a href="#" className={route.group ? "" : "on"} onClick={(e) => pick(e, () => open("store"))}>{t("cexit.allGroups")}</a>
            {groups.map((g) => <a key={g.id} href="#" className={route.group === g.id ? "on" : ""} onClick={(e) => pick(e, () => open("store", { group: g.id }))}>{g.name}</a>)}
          </nav>
        )}
        <main className="cxe-main">{children}</main>
      </div>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

const Store = (props: SkinProps) => {
  const look = lookOf(props.major, props.game.hour);
  return <StoreFrame {...props}><StoreFront {...props} steps={look === "flat" || look === "seven"} /></StoreFrame>;
};

const Client = (props: SkinProps) => <StoreFrame {...props}><ClientArea game={props.game} customerId={props.route.query.get("c")} /></StoreFrame>;

function Login({ game, variant, major, onLogin }: SkinProps & { onLogin: () => void }) {
  return (
    <div className={`portal cxe cxe-${lookOf(major, game.hour)} cxe-login`}>
      <form className="cxe-loginbox" onSubmit={(e) => pick(e, onLogin)}>
        <div className="cxe-loginhead"><Mark /><span className="cxe-area">{t("cexit.admin")}</span></div>
        <label>{t("shop-admin.username")}<input name="username" defaultValue="admin" autoComplete="off" /></label>
        <label>{t("shop-admin.password")}<input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
        <button type="submit" className="btn primary">{t("shop-admin.login")}</button>
      </form>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

// The licence screen of a locked admin, and the closed store, in the frame of their area.
const Bare = (props: SkinProps & { children: ReactNode }) =>
  props.route.area === "admin" ? <AdminFrame {...props} title={SCREEN_LABEL.licence} /> : <StoreFrame {...props} />;

export const clientExitSkin: Skin = { Admin, Store, Client, Login, Bare };
