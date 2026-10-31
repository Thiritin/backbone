import { t } from "../../../../../i18n/en";
import { Logo } from "../../../../art/logos";
import { Body, classesOf, Link, Nav, News, TITLE, type VendorProps } from "./VendorSite";
import "./plain.css";

// One plain layout for the smaller makers: the wordmark in the maker's colour, a pitch and the product classes.
const PITCH: Record<string, [early: string, late: string]> = {
  nettgear: [t("browser-sites-2.pitchNettgearEarly"), t("browser-sites-2.pitchNettgearLate")],
  ubiquitea: [t("browser-sites-2.pitchUbiquiteaEarly"), t("browser-sites-2.pitchUbiquiteaLate")],
  "d-lunk": [t("browser-sites-2.pitchDlunkEarly"), t("browser-sites-2.pitchDlunkLate")],
  netgoat: [t("browser-sites-2.pitchNetgoatEarly"), t("browser-sites-2.pitchNetgoatLate")],
  sophosphate: [t("browser-sites-2.pitchSophosphateEarly"), t("browser-sites-2.pitchSophosphateLate")],
  apcee: [t("browser-sites-2.pitchApceeEarly"), t("browser-sites-2.pitchApceeLate")],
  vertivo: [t("browser-sites-2.pitchVertivoEarly"), t("browser-sites-2.pitchVertivoLate")],
};
export function Plain(props: VendorProps) {
  const { m, look, page, go, month, year } = props;
  const [early, late] = PITCH[m.id] ?? ["", ""];
  return (
    <div className={`vs vs-plain vs-${m.id} ${look}`}>
      <header>
        <span className="vs-wm"><Logo provider={m.id} size={22} />{m.name}</span>
        <Nav page={page} go={go} />
      </header>
      {page === "home" ? (
        <main>
          <section className="vs-hero">
            <h1>{look === "early" ? early : late}</h1>
            <Link to="products" go={go} className="vs-cta">{t("browser-sites-2.vProducts")}</Link>
          </section>
          <ul className="vs-cats">{classesOf(m).map((c) => <li key={c}><Link to="products" go={go}>{c}</Link></li>)}</ul>
          <h2>{t("browser-sites-2.vNews")}</h2>
          <News m={m} month={month} limit={4} />
        </main>
      ) : (
        <main><h1>{TITLE[page]}</h1><Body {...props} className="vs-body" /></main>
      )}
      <footer>© {year} {m.name}</footer>
    </div>
  );
}
