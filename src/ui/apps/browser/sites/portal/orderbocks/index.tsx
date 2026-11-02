import type { ReactNode } from "react";
import { Home, KeyRound, Package, Receipt, RefreshCw, Server, ShoppingCart, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";
import { t } from "../../../../../../i18n/en";
import { activeServices } from "../../../../../../sim/30-customers/customers";
import { AdminScreen } from "../shared/AdminScreen";
import { ClientArea } from "../shared/ClientArea";
import { VersionFooter } from "../shared/Licence";
import { screenArgs, screenOf, type ScreenName } from "../shared/nav";
import { StoreFront } from "../shared/StoreFront";
import type { Skin, SkinProps } from "../skins";
import "../portal.css";
import "./skin.css";

// OrderBocks looks by installed major: 5.2 and 6.3 tabbed tables, 7 glossy menus, 8 flat blue, 9 a dark sidebar.
export type Era = "box" | "gloss" | "flat" | "panel";
export const eraOfMajor = (major: string): Era => (major === "7" ? "gloss" : major === "8" ? "flat" : major === "9" ? "panel" : "box");

export const Mark = () => <span className="ob-mark"><span className="ob-cube" aria-hidden />Order<b>Bocks</b></span>;

const GROUPS: { id: string; screens: ScreenName[] }[] = [
  { id: "sales", screens: ["clients", "orders", "invoices"] },
  { id: "catalog", screens: ["products", "options", "servers"] },
  { id: "settings", screens: ["licence", "updates"] },
];
const ICON: Partial<Record<ScreenName, LucideIcon>> = {
  home: Home, clients: Users, orders: ShoppingCart, invoices: Receipt, products: Package, options: SlidersHorizontal, servers: Server, licence: KeyRound, updates: RefreshCw,
};
const label = (n: ScreenName) => t(`orderbocks.nav.${n}`);

function NavLink({ n, on, go, icon }: { n: ScreenName; on: boolean; go: (n: ScreenName) => void; icon?: boolean }) {
  const Icon = ICON[n]!;
  return <a href="#" className={on ? "on" : ""} onClick={(e) => { e.preventDefault(); go(n); }}>{icon && <Icon size={16} aria-hidden />}{label(n)}</a>;
}

// One menu, laid out per era: tabs over a sub strip, hover menus, one flat bar, or grouped sidebar links.
function AdminNav({ era, current, go }: { era: Era; current: ScreenName; go: (n: ScreenName) => void }) {
  const group = GROUPS.find((g) => g.screens.includes(current));
  if (era === "box") return (
    <nav className="ob-nav">
      <div className="ob-tabs">
        <NavLink n="home" on={current === "home"} go={go} />
        {GROUPS.map((g) => <a key={g.id} href="#" className={g === group ? "on" : ""} onClick={(e) => { e.preventDefault(); go(g.screens[0]); }}>{t(`orderbocks.group.${g.id}`)}</a>)}
      </div>
      <div className="ob-sub">{(group?.screens ?? []).map((n) => <NavLink key={n} n={n} on={current === n} go={go} />)}</div>
    </nav>
  );
  if (era === "gloss") return (
    <nav className="ob-nav">
      <NavLink n="home" on={current === "home"} go={go} />
      {GROUPS.map((g) => (
        <div key={g.id} className={`ob-drop${g === group ? " on" : ""}`}>
          <button type="button">{t(`orderbocks.group.${g.id}`)}</button>
          <div className="ob-menu">{g.screens.map((n) => <NavLink key={n} n={n} on={current === n} go={go} />)}</div>
        </div>
      ))}
    </nav>
  );
  if (era === "flat") return <nav className="ob-nav">{["home", ...GROUPS.flatMap((g) => g.screens)].map((n) => <NavLink key={n} n={n as ScreenName} on={current === n} go={go} />)}</nav>;
  return (
    <nav className="ob-nav">
      <NavLink n="home" on={current === "home"} go={go} icon />
      {GROUPS.map((g) => (
        <div key={g.id} className="ob-group">
          <h3>{t(`orderbocks.group.${g.id}`)}</h3>
          {g.screens.map((n) => <NavLink key={n} n={n} on={current === n} go={go} icon />)}
        </div>
      ))}
    </nav>
  );
}

// The frame every OrderBocks page sits in; title is the reseller's brand on the store, the panel name on the admin.
function Frame({ game, variant, major, kind, title, nav, top, children }: SkinProps & { kind: "admin" | "store"; title: ReactNode; nav?: ReactNode; top?: ReactNode; children: ReactNode }) {
  const era = eraOfMajor(major);
  return (
    <div className={`portal ob ob-${era} ob-${kind}`}>
      <header className="ob-head"><span className="ob-title">{title}</span>{top}</header>
      {era === "panel" && kind === "admin" ? <div className="ob-body">{nav}<main className="ob-main">{children}</main></div> : <>{nav}<main className="ob-main">{children}</main></>}
      <footer className="ob-foot"><VersionFooter game={game} variant={variant} /></footer>
    </div>
  );
}

function Admin(props: SkinProps) {
  const { game, route, open, major } = props, era = eraOfMajor(major), screen = screenOf(route.query);
  const go = (s: Parameters<typeof screenArgs>[0]) => open("admin", {}, screenArgs(s));
  const current: ScreenName = screen.name === "product" ? "products" : screen.name === "client" ? "clients" : screen.name;
  const group = GROUPS.find((g) => g.screens.includes(current));
  return (
    <Frame {...props} kind="admin" title={<Mark />} top={<span className="ob-who"><span>{game.company.name}</span><i aria-hidden>{game.company.name.slice(0, 1)}</i></span>}
      nav={<AdminNav era={era} current={current} go={(n) => go({ name: n })} />}>
      {era === "box" && <p className="ob-crumb">{[label("home"), group && t(`orderbocks.group.${group.id}`), current !== "home" && label(current)].filter(Boolean).join(" » ")}</p>}
      <section className="ob-card">
        <h1>{label(current)}</h1>
        <AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} browse={props.browse} />
      </section>
    </Frame>
  );
}

// The reseller's own storefront: its brand on top, OrderBocks underneath.
function StoreNav({ open, area }: SkinProps & { area: "store" | "client" }) {
  return (
    <nav className="ob-nav">
      <a href="#" className={area === "store" ? "on" : ""} onClick={(e) => { e.preventDefault(); open("store"); }}>{t("orderbocks.store.products")}</a>
      <a href="#" className={area === "client" ? "on" : ""} onClick={(e) => { e.preventDefault(); open("client"); }}>{t("orderbocks.store.account")}</a>
    </nav>
  );
}

function Store(props: SkinProps) {
  return (
    <Frame {...props} kind="store" title={props.game.company.name} nav={<StoreNav {...props} area="store" />}>
      <section className="ob-card"><StoreFront {...props} steps={eraOfMajor(props.major) !== "box"} /></section>
    </Frame>
  );
}

function SignIn({ title, user, onSubmit }: { title: string; user: ReactNode; onSubmit: () => void }) {
  return (
    <form className="ob-login" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <h1>{title}</h1>
      {user}
      <label>{t("shop-admin.password")}<input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
      <button type="submit" className="btn primary">{t("shop-admin.login")}</button>
    </form>
  );
}

// Without a customer in the address the client area starts at its sign-in, which opens the newest customer's account.
function Client(props: SkinProps) {
  const { game, route, open } = props, c = route.query.get("c");
  const newest = game.customers.filter((x) => x.churnedAt === null && activeServices(game.services, x.id).length > 0).at(-1);
  return (
    <Frame {...props} kind="store" title={game.company.name} nav={<StoreNav {...props} area="client" />}>
      {c !== null ? <section className="ob-card"><ClientArea game={game} customerId={c} /></section>
        : <SignIn title={t("orderbocks.clientTitle")} onSubmit={() => open("client", {}, { c: newest?.id ?? "" })}
          user={<label>{t("shop-store.email")}<input name="email" type="email" autoComplete="off" /></label>} />}
    </Frame>
  );
}

function Login(props: SkinProps & { onLogin: () => void }) {
  return (
    <Frame {...props} kind="admin" title={<Mark />}>
      <SignIn title={t("orderbocks.adminTitle")} onSubmit={props.onLogin}
        user={<label>{t("shop-admin.username")}<input name="username" defaultValue="admin" autoComplete="off" /></label>} />
    </Frame>
  );
}

const Bare = (props: SkinProps & { children: ReactNode }) => (
  <Frame {...props} kind={props.route.area === "admin" ? "admin" : "store"} title={props.route.area === "admin" ? <Mark /> : props.game.company.name}>
    <section className="ob-card">{props.children}</section>
  </Frame>
);

export const orderBocksSkin: Skin = { Admin, Store, Client, Login, Bare };
