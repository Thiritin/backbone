import { Check, X } from "lucide-react";
import { euroCents } from "../../../sim/00-core/money";
import { SLAS } from "../../../sim/10-catalog/products";
import { requestName, requirementsFor, type SalesRequest } from "../../../sim/30-market/market";
import { profileStats } from "../../../sim/40-support/tickets";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { CustomerLink } from "../customers/open";
import { initials, patience, PRODUCT, stamp } from "../support/labels";
import { UpgradeCompose } from "../support/CustomOrder";
import { specText } from "../../../sim/30-market/spec";
import { customerSpots, zoneSpots } from "../../../sim/20-world/properties";
import type { Hall } from "../../../sim/50-state";
import { goingHandsRate, goingRate, setColoRate, setHandsRate } from "../../../sim/90-actions/hall";
import { PriceField } from "./PriceField";
import "../support/support.css";
import "./sales.css";

// Positions a customer could take: free ones in colocation zones and the positions of empty cages.
const spareToRent = (h: Hall): number => {
  const taken = new Set(h.customers.flatMap((c) => customerSpots(h, c)).map((q) => `${q.x},${q.y}`));
  return h.zones.filter((z) => z.kind !== "meetme").flatMap(zoneSpots).filter((q) => !taken.has(`${q.x},${q.y}`)).length;
};

export const OPEN = ["open", "countered", "refused"];
export const STATUS: Record<SalesRequest["status"], string> = {
  open: t("misc2.statusOpen"), quoted: t("misc2.statusQuoted"), countered: t("misc2.statusCountered"), refused: t("misc2.statusRefused"), accepted: t("misc2.statusAccepted"), won: t("misc2.statusWon"), lost: t("misc2.statusLost"), declined: t("misc2.statusDeclined"),
};
export const SLA_LABEL = { basic: t("misc2.slaBasic"), business: t("misc2.slaBusiness"), premium: t("misc2.slaPremium") } as const;

export const need = (r: SalesRequest) => t("misc2.needLine", { domain: r.domain ?? "", spec: specText(r.product, r.spec), city: r.city, sla: r.sla === "basic" ? "" : SLA_LABEL[r.sla] });

export function Card({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const reqs = requirementsFor(game, r), missing = reqs.filter((x) => !x.ok);
  const sla = SLAS[r.sla];
  const customer = r.customerId ? game.customers.find((c) => c.id === r.customerId) : undefined;
  const expects = profileStats(r.profile);

  return (
    <div className={`sup-detail${missing.length && OPEN.includes(r.status) ? " greyed" : ""}`}>
      <div className="d-head">
        <div className="top"><h2>{specText(r.product, r.spec)}{r.kind === "expansion" && ` ${t("misc2.upgrade")}`}</h2><span className="id num">#{r.id.slice(3)}</span></div>
        <div className="facts">
          <span className="type">{PRODUCT[r.product]}</span>
          <span>{r.city}</span>
          <span className="num">{t("misc2.slaFacts", { sla: SLA_LABEL[r.sla], uptime: (sla.uptime * 100).toFixed(sla.uptime >= 0.999 ? 2 : 1), hours: sla.responseHours })}</span>
          <span>{t("misc2.replyWithin", { time: patience(expects.reply) })}</span>
          <span className="pill">{STATUS[r.status]}</span>
        </div>
      </div>

      <div className="cust">
        <div className="logo">{initials(requestName(r))}</div>
        <div>
          <div className="name">{customer ? <CustomerLink id={customer.id} name={customer.name} /> : requestName(r)}</div>
          <div className="sub">{r.company ? `${r.contact} · ` : ""}<span className="num">{t("misc2.received", { when: stamp(r.createdAt) })}</span></div>
        </div>
      </div>

      <ul className="sales-reqs">
        {reqs.map((x) => (
          <li key={x.key} className={x.ok ? "ok" : "bad"}>{x.ok ? <Check aria-label={t("misc2.met")} /> : <X aria-label={t("misc2.missing")} />}{t(x.key.replace("sales.need.", "sales.req."), x.params)}</li>
        ))}
      </ul>

      <div className="thread">
        {r.thread.map((m, i) => (
          <div key={i} className={`msg${m.from === "you" ? " you" : ""}`}>
            <div className="from">{m.from === "you" ? m.by ?? t("misc2.you") : r.contact} · <span className="num">{stamp(m.hour)}</span></div>
            <p>{t(m.key, m.params)}{i === 0 && r.kind !== "expansion" && ` ${t(`request.use.${r.profile}`)}`}{i === 0 && m.params.item && ` ${t("order.msg.item", m.params)}`}</p>
          </div>
        ))}
        {r.status === "quoted" && <div className="event"><span>{t("misc2.awaitingReply")}</span></div>}
      </div>

      {r.kind === "expansion" && r.spec && <UpgradeCompose key={r.status} r={r} />}
    </div>
  );
}

export function LostSales() {
  const game = useStore((s) => s.game);
  const lost = [...game.sales.lost].reverse();
  return (
    <div className="sales-lost">
      <div className="sup-list-h"><h2>{t("misc2.lostSales")}</h2></div>
      <table className="table">
        <thead><tr><th>{t("misc2.date")}</th><th>{t("misc2.customer")}</th><th>{t("misc2.request")}</th><th className="num">{t("misc2.marketPrice")}</th><th>{t("misc2.reason")}</th></tr></thead>
        <tbody>
          {lost.map((l, i) => (
            <tr key={i}>
              <td className="num">{stamp(l.hour)}</td>
              <td>{l.name}</td>
              <td>{specText(l.product, l.spec)}</td>
              <td className="num">{euroCents(l.reference)}</td>
              <td>{t(l.reason, l.params)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!lost.length && <div className="sup-none">{t("misc2.noLostSales")}</div>}
    </div>
  );
}

// GDD, Own datacenter: the spare positions of each own hall offered as rack space, at a price set against the city's going rate.
export function ColoListing() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const halls = game.properties.flatMap((p) => (p.hall ? [p.hall] : []));
  return (
    <div className="sales-lost">
      <div className="sup-list-h"><h2>{t("hall.rackSpace")}</h2></div>
      {halls.map((h) => {
        const loc = game.locations.find((l) => l.id === h.locationId)!, going = goingRate(loc.city), spare = spareToRent(h);
        return (
          <div key={h.locationId} className="colo-card">
            <div className="sup-list-h"><strong>{loc.name}</strong><span className="num">{t("hall.spare", { n: spare })}</span></div>
            <PriceField value={h.rate ?? going} reference={going} onChange={(v) => act(setColoRate, loc.id, v || null)} />
            {goingHandsRate(loc.city) > 0 && <PriceField label={t("figures.handsRate")} value={h.handsRate ?? goingHandsRate(loc.city)} reference={goingHandsRate(loc.city)} onChange={(v) => act(setHandsRate, loc.id, v || null)} />}
            <div className="loc-row">
              {h.rate === null
                ? <button className="btn primary" onClick={() => act(setColoRate, loc.id, going)}>{t("hall.list")}</button>
                : <button className="btn" onClick={() => act(setColoRate, loc.id, null)}>{t("hall.unlist")}</button>}
            </div>
            <table className="table">
              <thead><tr><th>{t("misc2.customer")}</th><th className="num">{t("hall.position")}</th><th className="num">{t("misc2.monthlyPrice")}</th><th>{t("hall.since")}</th></tr></thead>
              <tbody>
                {h.customers.map((c) => <tr key={c.id}><td>{c.name}</td><td className="num">{c.tile ? `${c.tile.x + 1}.${c.tile.y + 1}` : "-"}</td><td className="num">{euroCents(c.monthly)}</td><td className="num">{stamp(c.since)}</td></tr>)}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
