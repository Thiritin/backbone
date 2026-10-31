import { t } from "../../../../../i18n/en";
import { registrarHost } from "../../../../../sim/10-catalog/registrars";
import { derivedDomain } from "../../../../../sim/30-customers/domains";
import { Account, DomainSearch, own, Program, TldPrices, type RegistrarProps } from "./RegistrarPage";
import "./opensrsly.css";

const Mark = ({ size }: { size: number }) => (
  <svg className="rg-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <rect x="1" y="3" width="22" height="18" rx="2" fill="currentColor" />
    <path d="M5 9l4 3-4 3M11 16h7" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DOCS = [["lookup", t("browser-sites-1.os.lookup")], ["prices", t("browser-sites-1.os.prices")], ["contract", t("browser-sites-1.os.contract")], ["account", t("browser-sites-1.os.account")]] as const;

// OpenSRSly: the plain 2005 developer page with API notes and a login box; from 2016 a dark docs site with a teal accent.
export function OpenSRSly({ game, r, look, year }: RegistrarProps) {
  const name = game.company.domain ?? derivedDomain(game), mine = own(game, r);
  const wm = <span className="rg-wm"><Mark size={22} />OpenSRSly</span>;
  if (look === "late") {
    const code = (path: string) => <code>{path}</code>;
    return (
      <div className="rg rg-opensrsly late">
        <header>{wm}<span className="ver">API v2</span></header>
        <div className="docs">
          <nav>{DOCS.filter(([id]) => id !== "account" || mine).map(([id, label]) => (
            <button key={id} type="button" onClick={() => document.getElementById(`osr-${id}`)?.scrollIntoView({ behavior: "smooth" })}>{label}</button>
          ))}</nav>
          <main>
            <section id="osr-lookup"><DomainSearch game={game} r={r} title={<>{t("browser-sites-1.os.lookup")} {code("GET /v2/domains")}</>} button={t("browser-sites-1.os.send")} /></section>
            <section id="osr-prices"><TldPrices game={game} r={r} title={<>{t("browser-sites-1.os.prices")} {code("GET /v2/prices")}</>} columns={2} /></section>
            <section id="osr-contract"><Program game={game} r={r} title={<>{t("browser-sites-1.os.contract")} {code("POST /v2/resellers")}</>} sign={t("browser-sites-1.os.create")} /></section>
            {mine && <section id="osr-account"><Account game={game} r={r} title={<>{t("browser-sites-1.os.account")} {code("GET /v2/account")}</>} /></section>}
          </main>
        </div>
        <footer>{t("browser-sites-1.os.copyright", { year })} {registrarHost(r)}</footer>
      </div>
    );
  }
  return (
    <div className="rg rg-opensrsly early">
      <header>{wm}<span>{t("browser-sites-1.os.api")}</span></header>
      <div className="cols">
        <main>
          <h1>{t("browser-sites-1.os.h1")}</h1>
          <pre>{`POST /api HTTP/1.0\n<action>LOOKUP</action>\n<domain>${name}</domain>\n\n200 OK\n<status>${game.company.domain ? "taken" : "available"}</status>`}</pre>
          <section><DomainSearch game={game} r={r} title={t("browser-sites-1.os.lookup")} button={t("browser-sites-1.os.submit")} /></section>
          <section><TldPrices game={game} r={r} title={t("browser-sites-1.os.priceList")} /></section>
          {mine && <section><Account game={game} r={r} /></section>}
        </main>
        <aside className="login"><Program game={game} r={r} title={mine ? t("browser-sites-1.os.loggedIn", { name: game.company.name }) : t("browser-sites-1.os.login")} sign={t("browser-sites-1.os.create")} /></aside>
      </div>
      <footer>{t("browser-sites-1.os.updated", { year })} {registrarHost(r)}</footer>
    </div>
  );
}
