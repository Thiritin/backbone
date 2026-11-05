import { useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { AdminScreen, SCREEN_LABEL, titleOf } from "../shared/AdminScreen";
import { ClientArea } from "../shared/ClientArea";
import { VersionFooter } from "../shared/Licence";
import { navOf, screenArgs, screenOf, type ScreenName } from "../shared/nav";
import { StoreFront } from "../shared/StoreFront";
import type { LoginProps, Skin, SkinProps } from "../skins";
import { LoginNote } from "../Login";
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

// The top bar of every version: each entry opens its first screen and lists the others in the row below.
type Group = "home" | "clients" | "billing" | "packages" | "support" | "tools" | "settings";
const GROUPS: [Group, ScreenName, ScreenName[]][] = [
  ["home", "home", []], ["clients", "clients", ["clients"]], ["billing", "invoices", ["orders", "invoices", "quotes"]], ["packages", "products", ["products", "servers"]],
  ["support", "emails", ["emails"]], ["tools", "import", ["import", "updates"]], ["settings", "settings", ["settings", "gateways", "marketplace", "licence"]],
];
const labels = (): Partial<Record<ScreenName, string>> => ({
  ...SCREEN_LABEL, home: t("blessta.dashboard"), clients: t("blessta.browseClients"), products: t("shop-store.lblPkgGroups"), quotes: t("shop-admin.quoteRequests"),
  import: t("shop-admin.d.import"), gateways: t("shop-market.gateways"),
});

function Admin(props: SkinProps) {
  const { game, route, open, major, variant } = props, screen = screenOf(route.query), era = eraOf(major), label = labels();
  const go = (s: Parameters<typeof screenArgs>[0]) => open("admin", {}, screenArgs(s));
  const current: ScreenName = screen.name === "import" || screen.name === "gateways" ? screen.name : navOf(screen.name);
  const [group, , screens] = GROUPS.find(([, , s]) => s.includes(current)) ?? GROUPS[0];
  const link = (s: ScreenName) => (
    <a key={s} href="#" className={current === s ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: s }); }}>{label[s]}</a>
  );
  return (
    <div className={`${cls(major)} bl-admin`}>
      <header className="bl-top">
        <Wordmark />
        <nav className="bl-tabs">
          {GROUPS.map(([g, to]) => <a key={g} href="#" className={g === group ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: to }); }}>{t(`blessta.group.${g}`)}</a>)}
        </nav>
      </header>
      {screens.length > 0 && <nav className="bl-sub">{screens.map(link)}</nav>}
      <main className={`bl-main${current === "home" ? " bl-home" : ""}`}>
        {era === "paradigm" && <p className="bl-crumb">{t(`blessta.group.${group}`)}</p>}
        <section className="bl-box">
          <h1 className="bl-boxhead">{titleOf(screen) ?? label[current]}</h1>
          <div className="bl-boxbody"><AdminScreen game={game} screen={screen} go={go} wizard dash="blesta" label={(n) => label[n] ?? n} toClient={(c) => open("client", {}, { c })} browse={props.browse} /></div>
        </section>
      </main>
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
      <label>{t("shop-admin.password")}<input type="password" autoComplete="off" /></label>
      <button type="submit" className="pt-btn primary" disabled={!pick}>{t("shop-admin.login")}</button>
    </form>
  );
}

function Login({ game, variant, major, onLogin, error, onForgot }: SkinProps & LoginProps) {
  return (
    <div className={`${cls(major)} bl-gate`}>
      <form className="bl-login" onSubmit={(e) => { e.preventDefault(); onLogin(e.currentTarget); }}>
        <div className="bl-loginhead"><Wordmark /></div>
        <label>{t("shop-admin.username")}<input name="username" autoComplete="off" /></label>
        <label>{t("shop-admin.password")}<input name="password" type="password" autoComplete="off" /></label>
        <button type="submit" className="pt-btn primary">{t("shop-admin.login")}</button>
        <LoginNote error={error} onForgot={onForgot} />
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
