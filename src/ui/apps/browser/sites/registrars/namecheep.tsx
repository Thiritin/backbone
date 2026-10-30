import { registrarHost } from "../../../../../sim/10-catalog/registrars";
import { Account, DomainSearch, own, Program, TldPrices, type RegistrarProps } from "./RegistrarPage";
import "./namecheep.css";

const Mark = ({ size }: { size: number }) => (
  <svg className="rg-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M2 4h10l10 8-10 8H2z" fill="currentColor" />
    <circle cx="7" cy="12" r="2.2" fill="#ffffff" />
  </svg>
);

// NameCheep: the orange 2005 search page with a TLD price grid; from 2015 flat orange on dark grey with cards.
export function NameCheep({ game, r, look, year }: RegistrarProps) {
  const wm = <span className="rg-wm"><Mark size={look === "late" ? 26 : 34} />Name<b>Cheep</b></span>;
  if (look === "late") {
    return (
      <div className="rg rg-namecheep late">
        <header>{wm}<span className="tag">Domains, hosting and SSL for less</span></header>
        <section className="hero"><DomainSearch game={game} r={r} title="Find your perfect domain" /></section>
        <main>
          <section className="card"><TldPrices game={game} r={r} title="Domain prices" columns={2} /></section>
          <section className="card"><Program game={game} r={r} title="Reseller program" /></section>
          {own(game, r) && <section className="card wide"><Account game={game} r={r} /></section>}
        </main>
        <footer>© {year} {registrarHost(r)}</footer>
      </div>
    );
  }
  return (
    <div className="rg rg-namecheep early">
      <header>{wm}<span className="tag">Cheap domain names!</span></header>
      <div className="stripe" />
      <main>
        <section className="box find"><DomainSearch game={game} r={r} title="Search for a domain name" button="Go!" /></section>
        <section className="box"><TldPrices game={game} r={r} title="Our low prices" grid /></section>
        <section className="box"><Program game={game} r={r} title="Become a reseller" sign="Sign up" /></section>
        {own(game, r) && <section className="box"><Account game={game} r={r} /></section>}
      </main>
      <footer>Copyright © 2000-{year} {registrarHost(r)}. All rights reserved.</footer>
    </div>
  );
}
