import { useState, type ReactNode } from "react";
import { Inbox, KeyRound, LayoutDashboard, Package, Receipt, RefreshCw, Server, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { t } from "../../../../../../i18n/en";
import { AdminScreen } from "../shared/AdminScreen";
import { ClientArea } from "../shared/ClientArea";
import { VersionFooter } from "../shared/Licence";
import { screenArgs, screenOf, type ScreenName } from "../shared/nav";
import { StoreFront } from "../shared/StoreFront";
import type { Skin, SkinProps } from "../skins";
import "../portal.css";
import "./skin.css";

// The installed major picks the look: 2 table and tab admin, 3 glossy portlets, 4 flat sidebar, 5 sectioned workspace.
type Era = "2" | "3" | "4" | "5";
const eraOf = (major: string): Era => (["3", "4", "5"].includes(major) ? major : "2") as Era;

const GROUPS: [string, ScreenName[]][] = [
  ["overview", ["home"]], ["billing", ["clients", "orders", "invoices"]], ["catalogue", ["products", "options"]],
  ["infra", ["servers"]], ["system", ["licence", "updates"]],
];
const ICON: Partial<Record<ScreenName, LucideIcon>> = {
  home: LayoutDashboard, clients: Users, orders: Inbox, invoices: Receipt, products: Package,
  options: SlidersHorizontal, servers: Server, licence: KeyRound, updates: RefreshCw,
};
const label = (n: ScreenName) => t(`ubersmyth.nav.${n}`);

const Anvil = () => (
  <svg className="ubs-anvil" viewBox="0 0 24 16" aria-hidden="true">
    <path d="M1 2h17c2.5 0 4.5 1.3 5 3h-6c-1 0-2 .8-2 2v1c0 1.2.9 2 2 2h1v2h-3l-1.5 2H5.5L4 12H1v-2h2c1.1 0 2-.8 2-2V7C5 4.8 3.3 3.4 1 3.2z" />
  </svg>
);
const Mark = () => <span className="ubs-mark"><span className="ubs-tile"><Anvil /></span><span className="ubs-word">ubersmyth</span></span>;

interface Link { id: string; label: string; on: boolean; go: () => void; icon?: LucideIcon }
const A = ({ l, className }: { l: Link; className?: string }) => (
  <a href="#" className={[className, l.on && "on"].filter(Boolean).join(" ")} aria-current={l.on ? "page" : undefined} onClick={(e) => { e.preventDefault(); l.go(); }}>
    {l.icon && <l.icon size={16} strokeWidth={1.75} aria-hidden="true" />}<span>{l.label}</span>
  </a>
);

// The admin frame: tabs in 2, pills and a portlet in 3, a grouped sidebar in 4, group switcher and tabs in 5.
function AdminFrame({ props, title, at, children }: { props: SkinProps; title?: string; at?: ScreenName; children: ReactNode }) {
  const { game, variant, open, major } = props, era = eraOf(major);
  const link = (n: ScreenName): Link => ({ id: n, label: label(n), on: at === n, go: () => open("admin", {}, screenArgs({ name: n })), icon: era === "4" ? ICON[n] : undefined });
  const groups = at ? GROUPS.map(([g, screens]) => ({ g, links: screens.map(link) })) : [];
  const flat = groups.flatMap((x) => x.links), group = groups.find((x) => x.links.some((l) => l.on));
  const foot = <VersionFooter game={game} variant={variant} />;
  const head = title && <h1 className="ubs-title">{title}</h1>;
  if (era === "4") {
    return (
      <div className={`portal ubs ubs-admin ubs-4 ubs-on-${at ?? "bare"}`}>
        <aside className="ubs-side">
          <Mark />
          {groups.map(({ g, links }) => <nav key={g}><h4>{t(`ubersmyth.group.${g}`)}</h4>{links.map((l) => <A key={l.id} l={l} />)}</nav>)}
        </aside>
        <div className="ubs-col"><header className="ubs-top">{head}</header><main className="ubs-main">{children}</main>{foot}</div>
      </div>
    );
  }
  if (era === "5") {
    return (
      <div className={`portal ubs ubs-admin ubs-5 ubs-on-${at ?? "bare"}`}>
        <header className="ubs-bar">
          <Mark />
          {groups.length > 0 && <nav className="ubs-seg">{groups.map(({ g, links }) => <A key={g} l={{ id: g, label: t(`ubersmyth.group.${g}`), on: group?.g === g, go: links[0].go }} />)}</nav>}
        </header>
        {group && group.links.length > 1 && <nav className="ubs-sub">{group.links.map((l) => <A key={l.id} l={l} />)}</nav>}
        <div className="ubs-col">{head}<main className="ubs-main">{children}</main></div>
        {foot}
      </div>
    );
  }
  if (era === "3") {
    return (
      <div className={`portal ubs ubs-admin ubs-3 ubs-on-${at ?? "bare"}`}>
        <header className="ubs-head"><Mark /></header>
        <nav className="ubs-pills">{flat.map((l) => <A key={l.id} l={l} />)}</nav>
        <div className="ubs-col"><section className="ubs-portlet">{title && <h2 className="ubs-portlet-head">{title}</h2>}<main className="ubs-main">{children}</main></section></div>
        {foot}
      </div>
    );
  }
  return (
    <div className={`portal ubs ubs-admin ubs-2 ubs-on-${at ?? "bare"}`}>
      <header className="ubs-head"><Mark /><span className="ubs-host">{game.company.domain && `portal.${game.company.domain}`}</span></header>
      <nav className="ubs-tabs">{flat.map((l) => <A key={l.id} l={l} />)}</nav>
      {title && at !== "home" && <div className="ubs-crumb">{t("ubersmyth.nav.home")} <span>›</span> {title}</div>}
      <main className="ubs-main">{children}</main>
      {foot}
    </div>
  );
}

// The store and client portal frame: one header with Order and Client portal in every era.
function StoreFrame({ props, at, children }: { props: SkinProps; at?: "store" | "client"; children: ReactNode }) {
  const { game, variant, open, major } = props, era = eraOf(major);
  const links: Link[] = at ? [
    { id: "store", label: t("ubersmyth.store.order"), on: at === "store", go: () => open("store") },
    { id: "client", label: t("ubersmyth.store.portal"), on: at === "client", go: () => open("client") },
  ] : [];
  return (
    <div className={`portal ubs ubs-store ubs-${era}`}>
      <header className="ubs-head"><Mark /><nav className="ubs-links">{links.map((l) => <A key={l.id} l={l} />)}</nav></header>
      {era === "2" && at === "store" && <div className="ubs-crumb">{t("ubersmyth.store.orderForm")}</div>}
      <main className="ubs-main">{children}</main>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

function Admin(props: SkinProps) {
  const { game, route, open, browse } = props, screen = screenOf(route.query);
  const at: ScreenName = screen.name === "product" ? "products" : screen.name === "client" ? "clients" : screen.name;
  const go = (s: Parameters<typeof screenArgs>[0]) => open("admin", {}, screenArgs(s));
  return (
    <AdminFrame props={props} at={at} title={label(at)}>
      <AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} browse={browse} />
    </AdminFrame>
  );
}

const Store = (props: SkinProps) => (
  <StoreFrame props={props} at="store"><StoreFront {...props} steps={eraOf(props.major) !== "2"} /></StoreFrame>
);

// The client portal signs a client in by name, then shows that client's services, invoices and tickets.
function Client(props: SkinProps) {
  const { game, route, open } = props, c = route.query.get("c");
  const clients = game.customers.filter((x) => x.churnedAt === null);
  const [pick, setPick] = useState(clients[0]?.id ?? "");
  return (
    <StoreFrame props={props} at="client">
      {c ? <>
        <p className="ubs-who"><a href="#" onClick={(e) => { e.preventDefault(); open("client"); }}>{t("ubersmyth.store.signOut")}</a></p>
        <ClientArea game={game} customerId={c} />
      </> : (
        <form className="ubs-signin" onSubmit={(e) => { e.preventDefault(); if (pick) open("client", {}, { c: pick }); }}>
          <h2>{t("ubersmyth.store.portal")}</h2>
          <label>{t("ubersmyth.store.client")}
            <select value={pick} onChange={(e) => setPick(e.target.value)}>{clients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
          <label>{t("shop-admin.password")}<input type="password" defaultValue="password" autoComplete="off" /></label>
          <button type="submit" className="btn primary" disabled={!pick}>{t("ubersmyth.store.signIn")}</button>
        </form>
      )}
    </StoreFrame>
  );
}

function Login({ major, onLogin }: SkinProps & { onLogin: () => void }) {
  return (
    <div className={`portal ubs ubs-login ubs-${eraOf(major)}`}>
      <div className="ubs-login-art"><Mark /></div>
      <form onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
        <h1><Mark /><span>{t("ubersmyth.login.title")}</span></h1>
        <label>{t("shop-admin.username")}<input name="username" defaultValue="admin" autoComplete="off" /></label>
        <label>{t("shop-admin.password")}<input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
        <button type="submit" className="btn primary">{t("shop-admin.login")}</button>
      </form>
    </div>
  );
}

// The licence-locked admin keeps the admin frame without its navigation; the closed store keeps the store header.
const Bare = ({ children, ...props }: SkinProps & { children: ReactNode }) =>
  props.route.area === "admin"
    ? <AdminFrame props={props} title={t("ubersmyth.nav.licence")}>{children}</AdminFrame>
    : <StoreFrame props={props}>{children}</StoreFrame>;

export const ubersmythSkin: Skin = { Admin, Store, Client, Login, Bare };
