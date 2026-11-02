import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { ClientArea } from "../shared/ClientArea";
import { VersionFooter } from "../shared/Licence";
import { StoreFront } from "../shared/StoreFront";
import type { SkinProps } from "../skins";
import { lookOf } from "./Admin";
import "../portal.css";
import "./skin.css";

const link = (on: () => void) => (e: { preventDefault: () => void }) => { e.preventDefault(); on(); };

function Groups({ game, route, open }: SkinProps) {
  return (
    <ul className="whc-groups">
      {game.shop.productGroups.filter((g) => !g.hidden).map((g) => (
        <li key={g.id}><a href="#" className={route.area === "store" && route.group === g.id ? "on" : ""} onClick={link(() => open("store", { group: g.id }))}>{g.name}</a></li>
      ))}
    </ul>
  );
}

// Signing in opens the client area of the newest active customer.
function ClientLogin({ game, open }: SkinProps) {
  const c = game.customers.filter((x) => x.churnedAt === null).at(-1);
  return (
    <form className="whc-clientlogin" onSubmit={(e) => { e.preventDefault(); if (c) open("client", {}, { c: c.id }); }}>
      <label>{t("shop-store.email")}<input name="email" type="email" autoComplete="off" /></label>
      <label>{t("shop-admin.password")}<input name="password" type="password" autoComplete="off" /></label>
      <button type="submit" className="btn primary">{t("shop-admin.login")}</button>
    </form>
  );
}

const titleOf = ({ game, route }: SkinProps): string =>
  route.area === "client" ? t("shop-admin.clientArea")
    : route.area === "configure" ? t("shop-store.configure")
    : route.area === "cart" ? t("shop-store.cart")
    : game.shop.productGroups.find((g) => g.id === route.group)?.name ?? t("shop-whmCache.store");

// The store and client frame of each look.
export function StoreFrame(props: SkinProps & { children: ReactNode }) {
  const { game, variant, major, route, open, children } = props, look = lookOf(major), title = titleOf(props);
  const tabs = (
    <nav className="whc-tabs">
      <a href="#" className={route.area !== "client" ? "on" : ""} onClick={link(() => open("store"))}>{t("shop-whmCache.store")}</a>
      <a href="#" className={route.area === "client" ? "on" : ""} onClick={link(() => open("client"))}>{t("shop-admin.clientArea")}</a>
    </nav>
  );
  const brand = <a href="#" className="whc-co" onClick={link(() => open("store"))}>{game.company.name}</a>;
  if (look === "classic") {
    return (
      <div className="portal whc whc-store whc-classic">
        <div className="whc-page">
          <header className="whc-brand">{brand}</header>
          {tabs}
          <div className="whc-body">
            <aside className="whc-sidebar">
              <section><h3>{t("shop-store.lblCategories")}</h3><Groups {...props} /></section>
              {route.area !== "client" && <section><h3>{t("shop-whmCache.clientLogin")}</h3><ClientLogin {...props} /></section>}
            </aside>
            <main className="whc-main"><h1 className="whc-title">{title}</h1>{children}</main>
          </div>
          <VersionFooter game={game} variant={variant} />
        </div>
      </div>
    );
  }
  if (look === "gloss") {
    return (
      <div className="portal whc whc-store whc-gloss">
        <header className="whc-brand">{brand}</header>
        {tabs}
        <div className="whc-hero"><h1>{title}</h1></div>
        <div className="whc-body">
          <aside className="whc-sidebar">
            <section><h3>{t("shop-store.lblCategories")}</h3><Groups {...props} /></section>
          </aside>
          <main className="whc-main">{children}</main>
        </div>
        <VersionFooter game={game} variant={variant} />
      </div>
    );
  }
  return (
    <div className="portal whc whc-store whc-flat">
      <header className="whc-brand">{brand}{tabs}</header>
      <div className="whc-wrap">
        {title !== t("shop-whmCache.store") && <p className="whc-path"><a href="#" onClick={link(() => open("store"))}>{t("shop-whmCache.store")}</a><span>/</span>{title}</p>}
        {route.area === "store" && <Groups {...props} />}
        <main className="whc-main">{children}</main>
      </div>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
}

export const WhmCacheStore = (props: SkinProps) =>
  <StoreFrame {...props}><StoreFront {...props} steps={lookOf(props.major) !== "classic"} /></StoreFrame>;

export function WhmCacheClient(props: SkinProps) {
  const c = props.route.query.get("c");
  return (
    <StoreFrame {...props}>
      {c ? <ClientArea game={props.game} customerId={c} /> : <div className="whc-signin"><h2>{t("shop-whmCache.clientLogin")}</h2><ClientLogin {...props} /></div>}
    </StoreFrame>
  );
}
