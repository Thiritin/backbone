import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { yearOf } from "../../../../../../sim/00-core/time";
import { versionInfo } from "../../../../../../sim/10-catalog/software-versions";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { AdminScreen } from "../shared/AdminScreen";
import { ClientArea } from "../shared/ClientArea";
import { VersionFooter } from "../shared/Licence";
import { screenArgs, screenOf, type Screen, type ScreenName } from "../shared/nav";
import { StoreFront } from "../shared/StoreFront";
import type { Skin, SkinProps } from "../skins";
import { Cube, Icon, OpenBox } from "./marks";
import "../portal.css";
import "./skin.css";

// BoxBillin' 1 and 2 ship the glossy cube look, 3 and 4 a flat slate one, FOSSBillin' 0.x a light one.
type Era = "cube" | "slate" | "foss";
export const eraOf = (major: string): Era => (major.startsWith("0.") ? "foss" : Number(major) >= 3 ? "slate" : "cube");

const GROUPS: [string, ScreenName[]][] = [
  ["shop", ["home", "products", "options", "servers"]],
  ["billing", ["orders", "clients", "invoices"]],
  ["system", ["licence", "updates"]],
];
const TILES: ScreenName[] = ["orders", "clients", "invoices", "products", "servers", "updates"];
const label = (n: ScreenName) => t(`shop-boxBillin.nav.${n}`);

function Brand({ era, variant, version }: { era: Era; variant: SkinProps["variant"]; version: string }) {
  const name = versionInfo(variant, version)?.name || shopById(variant).name;
  return <span className="bx-brand">{era === "foss" ? <OpenBox /> : <Cube />}<b>{name}</b></span>;
}

function AdminFrame(props: SkinProps & { children: ReactNode }) {
  const era = eraOf(props.major);
  return (
    <div className={`portal shop bx bx-${era} bx-admin`}>
      <header className="bx-top"><Brand era={era} variant={props.variant} version={props.version} /><span className="bx-who">{t("shop-boxBillin.admin")}</span></header>
      <div className="bx-body">{props.children}</div>
      <VersionFooter game={props.game} variant={props.variant} />
    </div>
  );
}

function Admin(props: SkinProps) {
  const { game, route, open, major, browse } = props, era = eraOf(major), screen = screenOf(route.query);
  const go = (s: Screen) => open("admin", {}, screenArgs(s));
  const current = screen.name === "product" ? "products" : screen.name === "client" ? "clients" : screen.name;
  const link = (n: ScreenName) => (
    <a key={n} href="#" className={current === n ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: n }); }}><Icon name={n} /><span>{label(n)}</span></a>
  );
  return (
    <AdminFrame {...props}>
      <nav className="bx-nav">
        {era === "slate"
          ? GROUPS.map(([g, names]) => <div key={g} className="bx-group"><b>{t(`shop-boxBillin.group.${g}`)}</b>{names.map(link)}</div>)
          : GROUPS.flatMap(([, names]) => names).map(link)}
      </nav>
      <main className="bx-main">
        {era === "cube" && current === "home" && <div className="bx-tiles">{TILES.map(link)}</div>}
        <h1 className="bx-title">{label(current)}</h1>
        <div className="bx-panel"><AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} browse={browse} /></div>
      </main>
    </AdminFrame>
  );
}

function StoreFrame(props: SkinProps & { children: ReactNode }) {
  const { game, variant, version, major, route, open } = props, era = eraOf(major), client = route.area === "client";
  const links = (
    <>
      <a href="#" className={client ? "" : "on"} onClick={(e) => { e.preventDefault(); open("store"); }}><Icon name="orders" /><span>{t("shop-boxBillin.order")}</span></a>
      <a href="#" className={client ? "on" : ""} onClick={(e) => { e.preventDefault(); open("client"); }}><Icon name="clients" /><span>{t("shop-boxBillin.clientArea")}</span></a>
    </>
  );
  return (
    <div className={`portal shop bx bx-${era} bx-store`}>
      <header className="bx-top"><Brand era={era} variant={variant} version={version} /><nav className="bx-links">{links}</nav></header>
      <div className="bx-body">
        <main className="bx-main">
          <h1 className="bx-title">{client ? t("shop-boxBillin.clientArea") : t("shop-boxBillin.order")}</h1>
          <div className="bx-panel">{props.children}</div>
        </main>
        {era === "cube" && <aside className="bx-side"><h2>{t("shop-boxBillin.menu")}</h2><nav>{links}</nav></aside>}
      </div>
      <footer className="bx-foot">
        <span>{t("shop-boxBillin.copyright", { year: yearOf(game.hour), name: game.company.name })}</span>
        <VersionFooter game={game} variant={variant} />
      </footer>
    </div>
  );
}

// The shared client area has no sign-in of its own; signing in here opens it for the newest active client.
function Client(props: SkinProps) {
  const { game, route, open } = props, id = route.query.get("c");
  const who = [...game.customers].reverse().find((c) => c.churnedAt === null);
  return (
    <StoreFrame {...props}>
      {id ? <ClientArea game={game} customerId={id} /> : (
        <form className="bx-signin" onSubmit={(e) => { e.preventDefault(); if (who) open("client", {}, { c: who.id }); }}>
          <label>{t("shop-boxBillin.email")}<input name="email" type="email" autoComplete="off" /></label>
          <label>{t("shop-admin.password")}<input name="password" type="password" autoComplete="off" /></label>
          <button type="submit" className="btn primary">{t("shop-boxBillin.signIn")}</button>
        </form>
      )}
    </StoreFrame>
  );
}

function Login(props: SkinProps & { onLogin: () => void }) {
  const era = eraOf(props.major);
  return (
    <div className={`portal shop bx bx-${era} bx-gate`}>
      <form className="bx-login" onSubmit={(e) => { e.preventDefault(); props.onLogin(); }}>
        <header><Brand era={era} variant={props.variant} version={props.version} /></header>
        <label>{t("shop-admin.username")}<input name="username" defaultValue="admin" autoComplete="off" /></label>
        <label>{t("shop-admin.password")}<input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
        <button type="submit" className="btn primary">{t("shop-boxBillin.signIn")}</button>
      </form>
      <VersionFooter game={props.game} variant={props.variant} />
    </div>
  );
}

// The licence-locked admin keeps the admin frame without its menu; the closed store keeps the store frame.
const Bare = (props: SkinProps & { children: ReactNode }) => (props.route.area === "admin"
  ? <AdminFrame {...props}><main className="bx-main"><h1 className="bx-title">{label("licence")}</h1><div className="bx-panel">{props.children}</div></main></AdminFrame>
  : <StoreFrame {...props}>{props.children}</StoreFrame>);

const Store = (props: SkinProps) => <StoreFrame {...props}><StoreFront {...props} steps={eraOf(props.major) === "foss"} /></StoreFrame>;

export const boxBillinSkin: Skin = { Admin, Store, Client, Login, Bare };
