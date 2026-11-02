import { useState, type CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { euroCents } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import { deskById, featuresAt, seats, tenantHost, type DeskFeature, type DeskId } from "../../../../../sim/10-catalog/desks";
import { deskItem, monthlyCharge, subscriptionPrice } from "../../../../../sim/10-catalog/store";
import { defaultTenant } from "../../../../../sim/40-support/desk";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { salesAddress } from "../../../../../sim/80-business/mail";
import { removeDesk, subscribeDesk } from "../../../../../sim/90-actions/desk-install";
import { Confirm } from "../../../../desktop/Confirm";
import { DESK } from "../../../support/desk";
import { usePageAct } from "../../pageAct";
import { eraOf } from "../era";
import "./hosted.css";

// zendusk.com and freshdusk.com: the marketing page, pricing per agent, sign-up and the account. Each vendor restyles its
// site with its product generations, by calendar year.
type Look = "early" | "mid" | "late";
const ERAS: Record<"zendusk" | "freshdusk", { from: number; look: Look }[]> = {
  zendusk: [{ from: 2007, look: "early" }, { from: 2012, look: "mid" }, { from: 2019, look: "late" }],
  freshdusk: [{ from: 2011, look: "early" }, { from: 2014, look: "mid" }, { from: 2019, look: "late" }],
};
const PAGES = ["home", "pricing", "signup", "account"] as const;
type Page = (typeof PAGES)[number];
const pageOf = (path: string): Page => PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home";
const SHOWN: DeskFeature[] = ["filters", "search", "assign", "templates", "slaTimers", "customerSidebar", "reports"];

const Mark = ({ id, className }: { id: DeskId; className: string }) => {
  const M = DESK[id].icon;
  return <span className={`dv-tile ${className}`} style={{ "--tile": DESK[id].tile } as CSSProperties}><M /></span>;
};

interface Props { game: GameState; id: "zendusk" | "freshdusk"; to: (p: Page) => void }

function Home({ game, id, to }: Props) {
  const d = deskById(id)!, look = eraOf(ERAS[id], yearOf(game.hour));
  const has = featuresAt(d, yearOf(game.hour));
  return (
    <>
      <section className="dv-hero">
        <Mark id={id} className="dv-hero-mark" />
        <h1>{t(`desk-sites.${id}.pitch.${look}`)}</h1>
        <button type="button" className="dv-btn" onClick={() => to("signup")}>{t("desk-sites.nav.signup")}</button>
      </section>
      <h2>{t("desk-sites.features")}</h2>
      <ul className="dv-features">{SHOWN.filter((f) => has.includes(f)).map((f) => <li key={f}>{t(`shop.feature.${f}`)}</li>)}</ul>
    </>
  );
}

function Pricing({ game, id, to }: Props) {
  const item = deskItem(deskById(id)!);
  return (
    <>
      <h1>{t("desk-sites.nav.pricing")}</h1>
      <table className="dv-table">
        <thead><tr><th>{t("desk-sites.plan")}</th><th>{t("desk-sites.agents")}</th><th>{t("desk-sites.monthly")}</th></tr></thead>
        <tbody><tr>
          <td>{t("desk-sites.perAgent", { price: euroCents(subscriptionPrice(item, yearOf(game.hour))) })}</td>
          <td className="num">{seats(game)}</td><td className="num">{euroCents(monthlyCharge(game, item))}</td>
        </tr></tbody>
      </table>
      <button type="button" className="dv-btn" onClick={() => to("signup")}>{t("desk-sites.nav.signup")}</button>
    </>
  );
}

function SignUp({ game, id, to }: Props) {
  const act = usePageAct(), d = deskById(id)!;
  const [company, setCompany] = useState(game.company.name), [email, setEmail] = useState(salesAddress(game)), [tenant, setTenant] = useState(defaultTenant(game));
  const suffix = tenantHost(d, "");
  return (
    <form className="dv-form" onSubmit={(e) => { e.preventDefault(); if (act(subscribeDesk, tenant, id).ok) to("account"); }}>
      <h1>{t("desk-sites.nav.signup")}</h1>
      <label>{t("desk-sites.company")}<input value={company} onChange={(e) => setCompany(e.target.value)} /></label>
      <label>{t("desk-sites.email")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>{t("desk-sites.address")}<span className="dv-host"><input value={tenant} autoComplete="off" onChange={(e) => setTenant(e.target.value)} /><span>{suffix}</span></span></label>
      <button type="submit" className="dv-btn">{t("desk-sites.create")}</button>
    </form>
  );
}

function Account({ game, id, to }: Props) {
  const act = usePageAct(), d = deskById(id)!, [cancelling, setCancelling] = useState(false);
  const mine = game.desk?.id === id && game.desk.tenant ? game.desk.tenant : null;
  if (!mine) return <><h1>{t("desk-sites.nav.account")}</h1><p>{t("desk-sites.noAccount")}</p><button type="button" className="dv-btn" onClick={() => to("signup")}>{t("desk-sites.nav.signup")}</button></>;
  return (
    <>
      <h1>{t("desk-sites.nav.account")}</h1>
      <table className="dv-table">
        <tbody>
          <tr><th>{t("desk-sites.address")}</th><td>{tenantHost(d, mine)}</td></tr>
          <tr><th>{t("desk-sites.agents")}</th><td className="num">{seats(game)}</td></tr>
          <tr><th>{t("desk-sites.monthly")}</th><td className="num">{euroCents(monthlyCharge(game, deskItem(d)))}</td></tr>
        </tbody>
      </table>
      <button type="button" className="dv-btn ghost" onClick={() => setCancelling(true)}>{t("desk-sites.cancel")}</button>
      {cancelling && <Confirm title={t("desk-sites.cancelTitle", { name: d.name })} text={t("desk-sites.cancelText", { name: d.name })} action={t("desk-sites.cancel")}
        onCancel={() => setCancelling(false)} onConfirm={() => { setCancelling(false); act(removeDesk); }} />}
    </>
  );
}

export function HostedDeskSite({ game, id, path, go }: { game: GameState; id: DeskId; path: string; go: (url: string) => void }) {
  if (id !== "zendusk" && id !== "freshdusk") return null;
  const d = deskById(id)!, page = pageOf(path), year = yearOf(game.hour), look = eraOf(ERAS[id], year);
  const to = (p: Page) => go(`${displayHost(d.hosts.vendor)}${p === "home" ? "/" : `/${p}`}`);
  const props = { game, id, to };
  return (
    <div className={`dv dv-${id} dv-${look}`}>
      <header className="dv-head">
        <a href="#" className="dv-logo" onClick={(e) => { e.preventDefault(); to("home"); }}><Mark id={id} className="dv-logo-mark" />{d.name}</a>
        <nav>{PAGES.map((p) => <a key={p} href="#" className={p === page ? "on" : ""} onClick={(e) => { e.preventDefault(); to(p); }}>{t(`desk-sites.nav.${p}`)}</a>)}</nav>
      </header>
      <main className={`dv-main dv-${page}`}>
        {page === "pricing" ? <Pricing {...props} /> : page === "signup" ? (game.desk?.id === id ? <Account {...props} /> : <SignUp {...props} />)
          : page === "account" ? <Account {...props} /> : <Home {...props} />}
      </main>
      <footer className="dv-foot">{t(`desk-sites.${id}.footer`, { year })}</footer>
    </div>
  );
}
