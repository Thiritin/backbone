import type { CSSProperties, ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { AGENCY_HOST, AGENCY_TITLE } from "../../../../../sim/80-business/browser";
import { owns } from "../../../../../sim/80-business/marketing";
import { DESIGN_DAYS, designQuote } from "../../../../../sim/80-business/website";
import { setUpChannel } from "../../../../../sim/90-actions/marketing";
import { redesign } from "../../../../../sim/90-actions/website";
import { metrics } from "../../../../../sim/metrics";
import { formatDay } from "../../../billing/format";
import { usePageAct } from "../../pageAct";
import { useOrder } from "../shared/OrderDone";
import { eraOf } from "../era";
import "./agency.css";

// One freelancer in 2005, a studio from 2013 and a full agency from 2021.
const ERAS = [{ from: 2005, look: "f" as const }, { from: 2013, look: "s" as const }, { from: 2021, look: "a" as const }];
const PAGES = ["home", "work", "quote", "about"] as const;
const WORK = [1, 2, 3, 4] as const;
const TEAM: [string, string][] = [["Jonas Mutt", "founder"], ["Lena Kraft", "design"], ["Tarek Brandt", "dev"], ["Mila Voss", "strategy"]];
const HUES = [28, 200, 140, 330];

type Go = (path: string) => void;
const A = ({ to, go, className, children }: { to: string; go: Go; className?: string; children: ReactNode }) => (
  <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);

function Quote({ game }: { game: GameState }) {
  const act = usePageAct(), has = owns(game, "website"), ready = game.marketing.designReady;
  const pay = useOrder(game, "services", AGENCY_TITLE, designQuote(game));
  return (
    <section className="ag-quote">
      <h2>{t("agency.quote.title", { company: game.company.name })}</h2>
      <dl>
        <dt>{t("agency.quote.design")}</dt><dd>{has ? game.marketing.designYear : t("marketing.none")}</dd>
        <dt>{t("agency.quote.size")}</dt><dd>{metrics(game).level.name}</dd>
        {has && <><dt>{t("agency.quote.delivery")}</dt><dd>{ready ? t("agency.quote.deliveredOn", { date: formatDay(ready.hour) }) : t("agency.quote.days", { n: DESIGN_DAYS })}</dd></>}
        <dt>{t("agency.quote.price")}</dt><dd className="ag-price">{euro(designQuote(game))}</dd>
      </dl>
      {!ready && pay.picker}
      <button className="ag-button" disabled={!!ready} onClick={() => pay.place(() => (has ? act(redesign, pay.method) : act(setUpChannel, "website", pay.method)))}>{t(has ? "agency.quote.orderRedo" : "agency.quote.orderNew")}</button>
      {pay.done}
    </section>
  );
}

const Work = () => (
  <ul className="ag-work">
    {WORK.map((i) => <li key={i} style={{ "--hue": HUES[i - 1] } as CSSProperties}><i aria-hidden />{t(`agency.work.${i}`)}</li>)}
  </ul>
);

function About({ look }: { look: "f" | "s" | "a" }) {
  return (
    <section>
      <h2>{t("agency.nav.about")}</h2>
      <p>{t(`agency.about.${look}`)}</p>
      {look === "a" && (
        <>
          <h2>{t("agency.team.title")}</h2>
          <ul className="ag-team">{TEAM.map(([name, role], i) => <li key={name} style={{ "--hue": HUES[i] } as CSSProperties}><i aria-hidden /><strong>{name}</strong><span>{t(`agency.team.${role}`)}</span></li>)}</ul>
        </>
      )}
    </section>
  );
}

function Home({ game, look, go }: { game: GameState; look: "f" | "s" | "a"; go: Go }) {
  const city = game.locations[0]?.city ?? "Frankfurt";
  if (look === "f") {
    return (
      <>
        <h1>{t("agency.f.heading", { city })}</h1>
        <div className="ag-construction" role="img" aria-label={t("agency.f.construction")}><span>{t("agency.f.construction")}</span></div>
        <p>{t("agency.f.pitch")}</p>
        <A to="/quote" go={go} className="ag-link">{t("agency.cta")}</A>
      </>
    );
  }
  return (
    <>
      <section className="ag-hero">
        <h1>{t(`agency.${look}.pitch`)}</h1>
        <A to="/quote" go={go} className="ag-button">{t("agency.cta")}</A>
      </section>
      <h2>{t("agency.work.title")}</h2>
      <Work />
    </>
  );
}

// Young von Mutt, the web design agency where the company site is ordered and redesigned.
export function AgencySite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const year = yearOf(game.hour), look = eraOf(ERAS, year);
  const first = path.split(/[?#]/)[0].split("/").filter(Boolean)[0];
  const page = PAGES.find((p) => p === first) ?? "home";
  const to: Go = (p) => go(`www.${AGENCY_HOST}${p}`);
  const body = (
    <>
      {page === "home" && <Home game={game} look={look} go={to} />}
      {page === "work" && <section><h2>{t("agency.work.title")}</h2><Work /></section>}
      {page === "quote" && <Quote game={game} />}
      {page === "about" && <About look={look} />}
    </>
  );
  const nav = PAGES.map((p) => <A key={p} to={p === "home" ? "/" : `/${p}`} go={to} className={p === page ? "on" : undefined}>{t(`agency.nav.${p}`)}</A>);
  return (
    <div className={`ag ${look}`}>
      {look === "f" ? (
        <table className="ag-table">
          <tbody>
            <tr><td colSpan={2} className="ag-logo">Young von Mutt</td></tr>
            <tr><td className="ag-menu"><nav>{nav}</nav></td><td className="ag-body">{body}</td></tr>
          </tbody>
        </table>
      ) : (
        <>
          <header className="ag-head"><span className="ag-logo">Young von Mutt</span><nav>{nav}</nav></header>
          <main className="ag-body">{body}</main>
        </>
      )}
      <footer className="ag-foot">{t("agency.foot", { year })}</footer>
    </div>
  );
}
