import { Ban, Check, CircleCheck, CircleX, Hourglass, Inbox, Send, X } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { SLAS } from "../../../sim/10-catalog/products";
import { missingFor, requestName, requirementsFor, type SalesRequest } from "../../../sim/30-market/market";
import { profileStats } from "../../../sim/40-support/tickets";
import type { GameState } from "../../../sim/50-state";
import { decline, quote } from "../../../sim/90-actions/sales";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import { initials, patience, PRODUCT, stamp } from "../support/labels";
import { PriceField } from "./PriceField";
import { UpgradeCompose } from "../support/CustomOrder";
import { specText } from "../../../sim/30-market/spec";
import "../support/support.css";
import "./sales.css";

export type SalesBox = "open" | "waiting" | "unserved" | "won";
export const OPEN = ["open", "countered", "refused"];
export const SALES_BOXES: { id: SalesBox; label: string; icon: typeof Inbox; match: (s: GameState, r: SalesRequest) => boolean }[] = [
  { id: "open", label: "Requests", icon: Inbox, match: (s, r) => OPEN.includes(r.status) && !missingFor(s, r).length },
  { id: "waiting", label: "Awaiting reply", icon: Hourglass, match: (_, r) => r.status === "quoted" },
  { id: "unserved", label: "Cannot serve", icon: Ban, match: (s, r) => r.status === "accepted" || (r.status === "open" && missingFor(s, r).length > 0) },
  { id: "won", label: "Won", icon: CircleCheck, match: (_, r) => r.status === "won" },
];
export const STATUS: Record<SalesRequest["status"], string> = {
  open: "New", quoted: "Quoted", countered: "Counter-offer", refused: "Refused", accepted: "Waiting for setup", won: "Won", lost: "Lost", declined: "Declined",
};
export const SLA_LABEL = { basic: "Basic", business: "Business", premium: "Premium" } as const;

export const need = (r: SalesRequest) => `${r.domain ? `${r.domain} · ` : ""}${specText(r.product, r.spec)} · ${r.city}${r.sla === "basic" ? "" : ` · ${SLA_LABEL[r.sla]} SLA`}`;

export function Deadline({ r, hour }: { r: SalesRequest; hour: number }) {
  if (!OPEN.includes(r.status)) return <span className="sla num">{stamp(r.createdAt)}</span>;
  const left = r.deadline - hour;
  return <span className={`sla ${left <= 12 ? "warn" : ""}`}><span className="num">{Math.max(0, left)}</span> h left</span>;
}

export function Card({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [price, setPrice] = useState(r.counter ?? r.quote ?? r.reference);
  const reqs = requirementsFor(game, r), missing = reqs.filter((x) => !x.ok);
  const sla = SLAS[r.sla];
  const canQuote = OPEN.includes(r.status) && !missing.length;
  const customer = r.customerId ? game.customers.find((c) => c.id === r.customerId) : undefined;
  const expects = profileStats(r.profile);

  return (
    <div className={`sup-detail${missing.length && OPEN.includes(r.status) ? " greyed" : ""}`}>
      <div className="d-head">
        <div className="top"><h2>{specText(r.product, r.spec)}{r.kind === "expansion" && " upgrade"}</h2><span className="id num">#{r.id.slice(3)}</span></div>
        <div className="facts">
          <span className="type">{PRODUCT[r.product]}</span>
          <span>{r.city}</span>
          <span>{SLA_LABEL[r.sla]} SLA · <span className="num">{(sla.uptime * 100).toFixed(sla.uptime >= 0.999 ? 2 : 1)}%</span> · <span className="num">{sla.responseHours}</span> h response</span>
          <span>Reply within {patience(expects.reply)}</span>
          <span className="pill">{STATUS[r.status]}</span>
        </div>
      </div>

      <div className="cust">
        <div className="logo">{initials(requestName(r))}</div>
        <div>
          <div className="name">{customer ? <CustomerLink id={customer.id} name={customer.name} /> : requestName(r)}</div>
          <div className="sub">{r.company ? `${r.contact} · ` : ""}Received <span className="num">{stamp(r.createdAt)}</span></div>
        </div>
      </div>

      <ul className="sales-reqs">
        {reqs.map((x) => (
          <li key={x.key} className={x.ok ? "ok" : "bad"}>{x.ok ? <Check aria-label="Met" /> : <X aria-label="Missing" />}{t(x.key.replace("sales.need.", "sales.req."), x.params)}</li>
        ))}
      </ul>

      <div className="thread">
        {r.thread.map((m, i) => (
          <div key={i} className={`msg${m.from === "you" ? " you" : ""}`}>
            <div className="from">{m.from === "you" ? m.by ?? "You" : r.contact} · <span className="num">{stamp(m.hour)}</span></div>
            <p>{t(m.key, m.params)}{i === 0 && r.kind !== "expansion" && ` ${t(`request.use.${r.profile}`)}`}</p>
          </div>
        ))}
        {r.status === "quoted" && <div className="event"><span>Awaiting reply</span></div>}
      </div>

      {r.kind === "expansion" && r.spec ? <UpgradeCompose r={r} /> : canQuote && (
        <div className="compose">
          <PriceField value={price} reference={r.reference} onChange={setPrice} />
          <div className="actions-row">
            <button className="btn ghost" onClick={() => act((s) => decline(s, r.id))}><CircleX />Decline</button>
            <span className="grow" />
            <span className="sales-total">Revenue <span className="num">{euroCents(price)}</span> a month</span>
            <button className="btn primary" disabled={!(price > 0)} onClick={() => act((s) => quote(s, r.id, price))}><Send />Send quote</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LostSales() {
  const game = useStore((s) => s.game);
  const lost = [...game.sales.lost].reverse();
  return (
    <div className="sales-lost">
      <div className="sup-list-h"><h2>Lost sales</h2></div>
      <table className="table">
        <thead><tr><th>Date</th><th>Customer</th><th>Request</th><th className="num">Market price</th><th>Reason</th></tr></thead>
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
      {!lost.length && <div className="sup-none">No lost sales</div>}
    </div>
  );
}
