import { t } from "../../../../../i18n/en";
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
  const wm = <span className="rg-wm"><Mark size={look === "late" ? 26 : 36} />GoDuddy<small>{t("browser-sites-1.gd.reseller")}</small></span>;
  if (look === "late") {
    return (
      <div className="rg rg-goduddy late">
        <header>{wm}</header>
        <section className="hero"><DomainSearch game={game} r={r} title={t("browser-sites-1.gd.start")} /></section>
        <main>
          <section><Program game={game} r={r} title={t("browser-sites-1.gd.plan")} /></section>
          <section><TldPrices game={game} r={r} title={t("browser-sites-1.gd.prices")} /></section>
          {own(game, r) && <section className="wide"><Account game={game} r={r} /></section>}
        </main>
        <footer>{t("browser-sites-1.gd.copyrightLate", { year })} {registrarHost(r)}</footer>
      </div>
    );
  }
  return (
    <div className="rg rg-goduddy early">
      <header>{wm}<span className="call">{t("browser-sites-1.gd.call")}</span></header>
      <section className="hero">
        <h1>{t("browser-sites-1.gd.h1")}</h1>
        <p>{t("browser-sites-1.gd.pitch")}</p>
      </section>
      <main>
        <section className="col"><DomainSearch game={game} r={r} title={t("browser-sites-1.gd.search")} button={t("browser-sites-1.gd.go")} /></section>
        <section className="col"><Program game={game} r={r} title={t("browser-sites-1.gd.plans")} sign={t("browser-sites-1.gd.signUp")} /></section>
        <section className="col"><TldPrices game={game} r={r} title={t("browser-sites-1.gd.hot")} /></section>
      </main>
      {own(game, r) && <section className="acct"><Account game={game} r={r} /></section>}
      <footer>{t("browser-sites-1.gd.copyrightEarly", { year })} {registrarHost(r)}</footer>
    </div>
  );
}
