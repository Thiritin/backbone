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

const DOCS = [["lookup", "Lookup"], ["prices", "Prices"], ["contract", "Contract"], ["account", "Account"]] as const;

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
            <section id="osr-lookup"><DomainSearch game={game} r={r} title={<>Lookup {code("GET /v2/domains")}</>} button="Send" /></section>
            <section id="osr-prices"><TldPrices game={game} r={r} title={<>Prices {code("GET /v2/prices")}</>} columns={2} /></section>
            <section id="osr-contract"><Program game={game} r={r} title={<>Contract {code("POST /v2/resellers")}</>} sign="Create account" /></section>
            {mine && <section id="osr-account"><Account game={game} r={r} title={<>Account {code("GET /v2/account")}</>} /></section>}
          </main>
        </div>
        <footer>© {year} OpenSRSly. {registrarHost(r)}</footer>
      </div>
    );
  }
  return (
    <div className="rg rg-opensrsly early">
      <header>{wm}<span>Reseller API</span></header>
      <div className="cols">
        <main>
          <h1>Domain reseller API</h1>
          <pre>{`POST /api HTTP/1.0\n<action>LOOKUP</action>\n<domain>${name}</domain>\n\n200 OK\n<status>${game.company.domain ? "taken" : "available"}</status>`}</pre>
          <section><DomainSearch game={game} r={r} title="Lookup" button="Submit" /></section>
          <section><TldPrices game={game} r={r} title="Price list" /></section>
          {mine && <section><Account game={game} r={r} /></section>}
        </main>
        <aside className="login"><Program game={game} r={r} title={mine ? `Logged in: ${game.company.name}` : "Reseller login"} sign="Create account" /></aside>
      </div>
      <footer>Last updated {year}. {registrarHost(r)}</footer>
    </div>
  );
}
