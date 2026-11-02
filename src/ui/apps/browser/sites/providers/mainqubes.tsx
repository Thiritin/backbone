import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { spacePrice } from "../../../../../sim/20-world/datacenters";
import { A, Body, citiesOf, dcsOf, fromPrice, Nav, SiteFacts, titleOf, type ProviderProps } from "./ProviderSite";
import type { Design } from "./registry";
import "./mainqubes.css";

const CERTS = ["ISO 27001", "EN 50600", "PCI DSS"];
// Site code the way the company names its buildings: city plus a running number.
const code = (id: string) => `${id.split("-").pop()!.toUpperCase()}01`;

// Isometric cube, the company mark.
const Cube = ({ size }: { size: number }) => (
  <svg className="mq-cube" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2 21 7 12 12 3 7z" fill="#6fd3c1" /><path d="M3 7 12 12v10L3 17z" fill="#1f9c8a" /><path d="M21 7 12 12v10l9-5z" fill="#13675c" />
  </svg>
);

// Frankfurt skyline for the early banner.
const Skyline = () => (
  <svg className="mq-sky" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 60V44h20v-8h14v8h10V30h12v14h16V18h10l4-8 4 8h8v42h6V26h16v34h8V8h6l3-8 3 8h6v52h10V34h18v26h8V22h14v38h12V40h16v20h10V28h20v32h14V46h18v14h12V36h16v24h20V48h20v12z" fill="#0f5c52" opacity="0.55" />
  </svg>
);

// mainqubes: 2005 a centred Frankfurt Mittelstand page with a teal banner and pipe-separated nav; 2015 dark, a cube mark, large site codes and certificate badges.
function Mainqubes(props: ProviderProps) {
  const { p, look, route, go, year } = props, dcs = dcsOf(p.id), cities = citiesOf(p.id).join(", ");
  const carriers = Math.max(...dcs.map((d) => d.carriers)), price = euro(fromPrice(p.id));
  const labels = { home: t("providers.mainqubes.navHome"), sites: t("providers.mainqubes.navSites"), order: t("providers.mainqubes.navColo"), account: t("providers.mainqubes.navPortal") };
  return (
    <div className={`ps ps-mainqubes ${look}`}>
      <div className="mq-page">
        <header>
          <A to="/" go={go} className="ps-wm"><Cube size={look === "early" ? 30 : 26} /><span>main<b>qubes</b></span></A>
          {look === "early" && <Skyline />}
          <Nav route={route} go={go} labels={labels} />
        </header>
        {route.page === "home" ? (look === "early" ? <main className="mq-two">
          <div>
            <h1>{t("providers.mainqubes.heroEarly", { cities })}</h1>
            <p>{t("providers.mainqubes.textEarly", { price, carriers })}</p>
            <ul>{CERTS.map((c) => <li key={c}>{c}</li>)}</ul>
            <A to="/order" go={go} className="ps-btn pri">{t("providers.mainqubes.cta")}</A>
          </div>
          <aside>
            {dcs.map((d) => <div key={d.id}><h3>{d.name}</h3><SiteFacts dc={d} /><A to={`/sites/${d.id}`} go={go}>{t("providers.mainqubes.more")}</A></div>)}
          </aside>
        </main> : <main>
          <section className="mq-hero">
            <div>
              <h1>{t("providers.mainqubes.heroLate")}</h1>
              <p>{t("providers.mainqubes.textLate", { cities, carriers })}</p>
              <A to="/order" go={go} className="ps-btn pri">{t("providers.mainqubes.cta")}</A>
            </div>
            <Cube size={150} />
          </section>
          <div className="mq-codes">{dcs.map((d) => <A key={d.id} to={`/sites/${d.id}`} go={go}><strong>{code(d.id)}</strong><span>{d.city}</span><span>{t("providers.mainqubes.from", { price: euro(spacePrice(d, "share", 8)) })}</span></A>)}</div>
          <div className="mq-certs"><span>{t("providers.mainqubes.certified")}</span>{CERTS.map((c) => <b key={c}>{c}</b>)}</div>
        </main>) : <main>
          <h1 className="mq-title">{titleOf(route)}</h1>
          <Body {...props} />
        </main>}
        <footer>{t("providers.mainqubes.footer", { year })} | {t("providers.imprint")} | {t("providers.terms")} | {t("providers.privacy")}</footer>
      </div>
    </div>
  );
}

export default { view: Mainqubes, late: 2015 } satisfies Design;
