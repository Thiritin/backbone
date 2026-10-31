import { t } from "../../../../../i18n/en";
import { registrarHost } from "../../../../../sim/10-catalog/registrars";
import { Account, DomainSearch, own, Program, TldPrices, type RegistrarProps } from "./RegistrarPage";
import "./internety.css";

const Mark = ({ size }: { size: number }) => (
  <svg className="rg-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M2 12h20M12 2q-5 10 0 20M12 2q5 10 0 20" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

// InterNetY: the dense white and blue German reseller page in both eras; from 2014 a blue header band and bigger type.
export function InterNetY({ game, r, look, year }: RegistrarProps) {
  return (
    <div className={`rg rg-internety ${look}`}>
      <header><span className="rg-wm"><Mark size={look === "late" ? 30 : 24} /><span>InterNet<b>Y</b></span></span><span className="sub">{t("browser-sites-1.in.sub")}</span></header>
      <main>
        <div className="left">
          <section><DomainSearch game={game} r={r} title={t("browser-sites-1.in.check")} button={t("browser-sites-1.in.checkButton")} /></section>
          <section><Program game={game} r={r} title={t("browser-sites-1.in.terms")} /></section>
        </div>
        <section className="right"><TldPrices game={game} r={r} title={t("browser-sites-1.in.prices")} columns={2} /></section>
        {own(game, r) && <section className="wide"><Account game={game} r={r} /></section>}
      </main>
      <footer><span>{t("browser-sites-1.in.imprint")}</span><span>{t("browser-sites-1.in.terms2")}</span><span>{t("browser-sites-1.in.privacy")}</span><span>{t("browser-sites-1.in.copyright", { year })} {registrarHost(r)}</span></footer>
    </div>
  );
}
