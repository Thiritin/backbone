import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { FLYER_HOST } from "../../../sim/10-catalog/flyers";
import { displayHost } from "../../../sim/80-business/browser";
import { leadsThisMonth } from "../../../sim/80-business/marketing";
import { useStore } from "../../store";

const count = (n: number) => Math.round(n).toLocaleString(LOCALE);

// Every running flyer run, with the way to the print shop for more.
export function FlyerCard() {
  const game = useStore((s) => s.game), openApp = useStore((s) => s.openApp);
  const runs = game.marketing.flyers.filter((r) => r.flyersLeft > 0);
  const expected = leadsThisMonth(game).filter((b) => b.source === "flyer").reduce((n, b) => n + b.count, 0);
  return (
    <div className="shop-card mkt-campaign">
      <div className="mkt-head">
        <strong>{t("marketing.flyers")}</strong>
        <span className={`pill${runs.length ? " accent" : ""}`}>{t(runs.length ? "marketing.running" : "marketing.off")}</span>
      </div>
      <dl className="shop-specs mkt-specs">
        <div><dt>{t("marketing.leadsThisMonth")}</dt><dd className="num">{expected < 10 ? expected.toFixed(1) : count(expected)}</dd></div>
      </dl>
      {runs.length ? runs.map((r) => (
        <div key={r.id} className="mkt-row">
          <span className="mkt-label">{r.city}</span>
          <span className="num">{t("flyers.left")}: {count(r.flyersLeft)}</span>
          <span className="num">{t("flyers.leads")}: {count(r.leads)}</span>
        </div>
      )) : <div className="mkt-row"><span>{t("marketing.noFlyers")}</span></div>}
      <div className="mkt-row mkt-end">
        <button className="btn primary" onClick={() => openApp("Browser", { kind: "url", id: `${displayHost(FLYER_HOST)}/flyers` })}>{t("marketing.orderFlyers")}</button>
      </div>
    </div>
  );
}
