import { t } from "../../../../../i18n/en";
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
  const wm = <span className="rg-wm"><Mark size={look === "late" ? 26 : 34} /><span>Name<b>Cheep</b></span></span>;
  if (look === "late") {
    return (
      <div className="rg rg-namecheep late">
        <header>{wm}<span className="tag">{t("browser-sites-1.nc.tagLate")}</span></header>
        <section className="hero"><DomainSearch game={game} r={r} title={t("browser-sites-1.nc.find")} /></section>
        <main>
          <section className="card"><TldPrices game={game} r={r} title={t("browser-sites-1.nc.prices")} columns={2} /></section>
          <section className="card"><Program game={game} r={r} title={t("browser-sites-1.nc.program")} /></section>
          {own(game, r) && <section className="card wide"><Account game={game} r={r} /></section>}
        </main>
        <footer>© {year} {registrarHost(r)}</footer>
      </div>
    );
  }
  return (
    <div className="rg rg-namecheep early">
      <header>{wm}<span className="tag">{t("browser-sites-1.nc.tagEarly")}</span></header>
      <div className="stripe" />
      <main>
        <section className="box find"><DomainSearch game={game} r={r} title={t("browser-sites-1.nc.search")} button={t("browser-sites-1.nc.go")} /></section>
        <section className="box"><TldPrices game={game} r={r} title={t("browser-sites-1.nc.low")} grid /></section>
        <section className="box"><Program game={game} r={r} title={t("browser-sites-1.nc.become")} sign={t("browser-sites-1.nc.signUp")} /></section>
        {own(game, r) && <section className="box"><Account game={game} r={r} /></section>}
      </main>
      <footer>{t("browser-sites-1.nc.copyright", { year, host: registrarHost(r) })}</footer>
    </div>
  );
}
