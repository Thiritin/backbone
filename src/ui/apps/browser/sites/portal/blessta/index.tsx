import { useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { AdminScreen, SCREEN_LABEL } from "../shared/AdminScreen";
import { ClientArea } from "../shared/ClientArea";
import { VersionFooter } from "../shared/Licence";
import { screenArgs, screenOf, type ScreenName } from "../shared/nav";
import { StoreFront } from "../shared/StoreFront";
import type { Skin, SkinProps } from "../skins";
import "../portal.css";
import "./skin.css";

// Blessta 1 and 2 ran on bevelled tabs, 3 and 4 on widgets under a dark bar, 5 on the Paradigm sidebar and 6 on its dark mode.
export type Era = "classic" | "widgets" | "paradigm";
const n = (major: string) => Number(major) || 0;
export const eraOf = (major: string): Era => (n(major) >= 5 ? "paradigm" : n(major) >= 3 ? "widgets" : "classic");
const cls = (major: string) => `portal bl bl-${eraOf(major)}${n(major) >= 6 ? " bl-dark" : ""}`;

// Three offset bars, the stack of stables the name is an anagram of.
export const Mark = () => (
  <svg className="bl-mark" viewBox="0 0 20 20" aria-hidden="true">
    <rect x="1" y="2" width="13" height="4.5" rx="1.2" /><rect x="6" y="7.75" width="13" height="4.5" rx="1.2" /><rect x="1" y="13.5" width="13" height="4.5" rx="1.2" />
  </svg>
);
export const Wordmark = () => <span className="bl-word"><Mark />{shopById("blessta").name.toLowerCase()}</span>;

type Group = "home" | "clients" | "billing" | "packages" | "settings";
const GROUPS: [Group, ScreenName[]][] = [
  ["home", ["home"]], ["clients", ["clients"]], ["billing", ["orders", "invoices"]], ["packages", ["products", "options", "servers"]], ["settings", ["licence", "updates"]],
];
const labels = (): Partial<Record<ScreenName, string>> => ({
  ...SCREEN_LABEL, home: t("blessta.dashboard"), clients: t("blessta.browseClients"), products: t("shop-store.lblPkgGroups"), options: t("blessta.packageOptions"),
});

const ICON: Partial<Record<ScreenName, string>> = {
  home: "M3 9.5 10 4l7 5.5V17H3z M8 17v-5h4v5", clients: "M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2 17c0-3 2.2-5 5-5s5 2 5 5 M13 4.5a2.5 2.5 0 0 1 0 5 M14 12c2 .4 4 2 4 5",
  orders: "M2 3h2.5l2 10h9.5l2-7H5.5 M8 17h.01 M15 17h.01", invoices: "M5 2h10v16l-2.5-1.5L10 18l-2.5-1.5L5 18z M8 7h4 M8 11h4",
  products: "M10 2 3 6v8l7 4 7-4V6z M3 6l7 4 7-4 M10 10v8", options: "M4 5h12 M4 10h12 M4 15h12 M7 3v4 M13 8v4 M9 13v4",
  servers: "M3 3h14v5H3z M3 12h14v5H3z M6 5.5h.01 M6 14.5h.01", licence: "M7.5 12a4 4 0 1 1 3-1.5L17 17l-1.5 1-1-1-1 1-1-1 M6.5 7.5h.01",
  updates: "M16 10a6 6 0 1 1-2-4.5 M16 3v4h-4",
};
const Icon = ({ name }: { name: ScreenName }) => <svg className="bl-icon" viewBox="0 0 20 20" aria-hidden="true"><path d={ICON[name]} /></svg>;

function Admin(props: SkinProps) {
  const { game, route, open, major, variant } = props, screen = screenOf(route.query), era = eraOf(major), label = labels();
  const go = (s: Parameters<typeof screenArgs>[0]) => open("admin", {}, screenArgs(s));
  const current: ScreenName = screen.name === "product" ? "products" : screen.name === "client" ? "clients" : screen.name;
  const [group, screens] = GROUPS.find(([, s]) => s.includes(current)) ?? GROUPS[0];
  const link = (s: ScreenName, icon = false) => (
    <a key={s} href="#" className={current === s ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: s }); }}>{icon && <Icon name={s} />}{label[s]}</a>
  );
  const body = (
    <main className="bl-main">
      {era === "paradigm" && <p className="bl-crumb">{t(`blessta.group.${group}`)}</p>}
      <section className="bl-box">
        <h1 className="bl-boxhead">{label[current]}</h1>
        <div className="bl-boxbody"><AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} browse={props.browse} /></div>
      </section>
    </main>
  );
  if (era === "paradigm") {
    return (
      <div className={`${cls(major)} bl-admin`}>
        <aside className="bl-side">
          <Wordmark />
          {GROUPS.map(([g, s]) => <nav key={g}>{g !== "home" && <h2>{t(`blessta.group.${g}`)}</h2>}{s.map((x) => link(x, true))}</nav>)}
        </aside>
        <div className="bl-col">{body}<VersionFooter game={game} variant={variant} /></div>
      </div>
    );
  }
  return (
    <div className={`${cls(major)} bl-admin`}>
      <header className="bl-top">
        <Wordmark />
        <nav className="bl-tabs">
          {GROUPS.map(([g, s]) => <a key={g} href="#" className={g === group ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: s[0] }); }}>{t(`blessta.group.${g}`)}</a>)}
        </nav>
      </header>
      <nav className="bl-sub">{screens.map((s) => link(s))}</nav>
      {body}
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

// The store and client area carry the host's name; Blessta signs only the footer.
function Front({ game, variant, open, major, title, children }: SkinProps & { title: string; children: ReactNode }) {
  const nav = (e: MouseEvent, area: "store" | "client") => { e.preventDefault(); open(area); };
  return (
    <div className={`${cls(major)} bl-front`}>
      <header className="bl-fhead">
        <div className="bl-wrap">
          <strong className="bl-company">{game.company.name}</strong>
          <nav><a href="#" onClick={(e) => nav(e, "store")}>{t("blessta.order")}</a><a href="#" onClick={(e) => nav(e, "client")}>{t("shop-admin.clientArea")}</a></nav>
        </div>
      </header>
      <div className="bl-hero"><div className="bl-wrap"><h1>{title}</h1></div></div>
      <main className="bl-wrap bl-fmain">{children}</main>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

const Store = (props: SkinProps) =>
  <Front {...props} title={t("blessta.order")}><StoreFront {...props} steps={eraOf(props.major) !== "classic"} /></Front>;

function Client(props: SkinProps) {
  const id = props.route.query.get("c");
  return <Front {...props} title={t("shop-admin.clientArea")}>{id ? <ClientArea game={props.game} customerId={id} /> : <ClientLogin {...props} />}</Front>;
}

// Signs in as one of the shop's clients.
function ClientLogin({ game, open }: SkinProps) {
  const active = game.customers.filter((c) => c.churnedAt === null);
  const [pick, setPick] = useState(active[0]?.id ?? "");
  return (
    <form className="bl-login" onSubmit={(e) => { e.preventDefault(); if (pick) open("client", {}, { c: pick }); }}>
      <h2>{t("blessta.signIn")}</h2>
      <label>{t("shop-admin.client")}<select value={pick} onChange={(e) => setPick(e.target.value)}>{active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>{t("shop-admin.password")}<input type="password" defaultValue="password" autoComplete="off" /></label>
      <button type="submit" className="btn primary" disabled={!pick}>{t("shop-admin.login")}</button>
    </form>
  );
}

function Login({ game, variant, major, onLogin }: SkinProps & { onLogin: () => void }) {
  return (
    <div className={`${cls(major)} bl-gate`}>
      <form className="bl-login" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
        <div className="bl-loginhead"><Wordmark /></div>
        <label>{t("shop-admin.username")}<input name="username" defaultValue="admin" autoComplete="off" /></label>
        <label>{t("shop-admin.password")}<input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
        <button type="submit" className="btn primary">{t("shop-admin.login")}</button>
      </form>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

// The licence-locked admin, and the closed store inside the store's own frame.
function Bare(props: SkinProps & { children: ReactNode }) {
  const { game, variant, major, children } = props;
  if (props.route.area !== "admin") return <Front {...props} title={t("blessta.order")}>{children}</Front>;
  return (
    <div className={`${cls(major)} bl-gate`}>
      <section className="bl-box bl-bare"><div className="bl-boxhead"><Wordmark /></div><div className="bl-boxbody">{children}</div></section>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

export const blesstaSkin: Skin = { Admin, Store, Client, Login, Bare };
