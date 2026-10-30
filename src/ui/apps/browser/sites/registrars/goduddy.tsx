import { registrarHost } from "../../../../../sim/10-catalog/registrars";
import { Account, DomainSearch, own, Program, TldPrices, type RegistrarProps } from "./RegistrarPage";
import "./goduddy.css";

const Mark = ({ size }: { size: number }) => (
  <svg className="rg-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="11" fill="currentColor" />
    <circle cx="8.5" cy="10" r="1.6" fill="#111111" /><circle cx="15.5" cy="10" r="1.6" fill="#111111" />
    <path d="M7 15q5 4 10 0" stroke="#111111" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>
);

// GoDuddy Reseller: the loud green and black 2005 page with three columns of offers; from 2016 white with a calmer grid.
export function GoDuddy({ game, r, look, year }: RegistrarProps) {
  const wm = <span className="rg-wm"><Mark size={look === "late" ? 26 : 36} />GoDuddy<small>Reseller</small></span>;
  if (look === "late") {
    return (
      <div className="rg rg-goduddy late">
        <header>{wm}</header>
        <section className="hero"><DomainSearch game={game} r={r} title="Start your domain business" /></section>
        <main>
          <section><Program game={game} r={r} title="Reseller plan" /></section>
          <section><TldPrices game={game} r={r} title="Domain prices" /></section>
          {own(game, r) && <section className="wide"><Account game={game} r={r} /></section>}
        </main>
        <footer>Copyright © 1999-{year} GoDuddy Operating Company, LLC. {registrarHost(r)}</footer>
      </div>
    );
  }
  return (
    <div className="rg rg-goduddy early">
      <header>{wm}<span className="call">24/7 SALES &amp; SUPPORT!</span></header>
      <section className="hero">
        <h1>Become a domain reseller TODAY!</h1>
        <p>Sell domain names under YOUR OWN brand and keep the profit! Set up in minutes! Bulk discounts at 100, 500 and 5,000 domains! SSL certificates for your customers! The world's No. 1 domain reseller program!*</p>
      </section>
      <main>
        <section className="col"><DomainSearch game={game} r={r} title="Domain search" button="GO!" /></section>
        <section className="col"><Program game={game} r={r} title="Reseller plans" sign="Sign up now!" /></section>
        <section className="col"><TldPrices game={game} r={r} title="Hot prices!" /></section>
      </main>
      {own(game, r) && <section className="acct"><Account game={game} r={r} /></section>}
      <footer>*Not all claims verified. Copyright © 1999-{year} {registrarHost(r)}</footer>
    </div>
  );
}
