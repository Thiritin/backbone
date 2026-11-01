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
import "../support/support.css";
import "./sales.css";

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
