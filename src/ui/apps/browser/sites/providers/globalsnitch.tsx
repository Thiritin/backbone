import { t } from "../../../../../i18n/en";
import { A, Body, citiesOf, dcsOf, Nav, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./globalsnitch.css";

// Globe with meridians and a teal orbit, the company mark.
const Globe = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="16" cy="16" rx="5" ry="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 16h24M6 10h20M6 22h20" stroke="currentColor" strokeWidth="1.2" />
    <ellipse cx="16" cy="16" rx="15" ry="5" fill="none" stroke="#21b2a6" strokeWidth="2" transform="rotate(-20 16 16)" />
  </svg>
);
const Mark = ({ size }: { size: number }) => <span className="gs-mark"><Globe size={size} /><span>GLOBAL<b>SNITCH</b></span></span>;

// Global Snitch: 2005 a fixed-width page on navy with a globe banner and tabbed nav, written like a landlord; 2014 white with a big city photo panel per building and a navy stats band.
function Globalsnitch(props: ProviderProps) {
  const { p, look, route, go, year } = props, dcs = dcsOf(p.id), cities = citiesOf(p.id);
  const labels = { home: t("providers.globalsnitch.navHome"), sites: t("providers.globalsnitch.navSites"), order: t("providers.globalsnitch.navColo"), account: t("providers.globalsnitch.navPortal") };
  const text = t("providers.globalsnitch.text", { cities: cities.join(", ") });
  const home = route.page === "home";
  return (
    <div className={`ps ps-globalsnitch ${look}`}>
      <div className="gs-page">
        <header>
          <A to="/" go={go} className="ps-wm"><Mark size={look === "early" ? 40 : 30} /></A>
          <Nav route={route} go={go} items={look === "early" ? ["home", "sites", "order", "account"] : ["sites", "order", "account"]} labels={labels} />
        </header>
        {home ? (look === "early" ? <main>
          <section className="gs-banner"><h1>{t("providers.globalsnitch.heroEarly")}</h1></section>
          <div className="gs-two">
            <div>
              <p>{text}</p>
              <h2>{t("providers.globalsnitch.owner")}</h2>
              <p>{t("providers.globalsnitch.ownerText")}</p>
            </div>
            <aside>
              <h3>{t("providers.globalsnitch.navSites")}</h3>
              {dcs.map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go}>{d.city}</A>)}
            </aside>
          </div>
        </main> : <main>
          <section className="gs-hero">
            <h1>{t("providers.globalsnitch.heroLate")}</h1>
            <p>{text}</p>
            <A to="/sites" go={go} className="ps-btn pri">{t("providers.globalsnitch.cta")}</A>
          </section>
          <div className="gs-band">
            <div><strong>{dcs.reduce((s, d) => s + d.carriers, 0)}</strong><span>{t("providers.globalsnitch.statCarriers")}</span></div>
            <div><strong>{Math.max(...dcs.map((d) => d.kwPerPosition))} kW</strong><span>{t("providers.globalsnitch.statPower")}</span></div>
            <div><strong>{Math.min(...dcs.map((d) => d.remoteHands.responseHours))} h</strong><span>{t("providers.globalsnitch.statHands")}</span></div>
          </div>
          <div className="gs-cities">{dcs.map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go}><strong>{d.city}</strong><span>{d.name}</span></A>)}</div>
          <section className="gs-owner"><h2>{t("providers.globalsnitch.owner")}</h2><p>{t("providers.globalsnitch.ownerText")}</p></section>
        </main>) : <main className="gs-body"><h1 className="gs-title">{titleOf(route)}</h1><Body {...props} /></main>}
        <footer><span>{t("providers.globalsnitch.footer", { year })}</span><span>{t("providers.legal")} · {t("providers.privacy")} · {t("providers.contactUs")}</span></footer>
      </div>
    </div>
  );
}

export default { view: Globalsnitch, late: 2014 } satisfies Design;
