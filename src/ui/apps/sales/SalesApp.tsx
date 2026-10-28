import { Ban, Check, CircleCheck, CircleX, Hourglass, Inbox, Send, TrendingDown, X } from "lucide-react";
import { useState } from "react";
import { yearOf } from "../../../sim/00-core/time";
import { euroCents } from "../../../sim/00-core/money";
import { planOf, SLAS } from "../../../sim/10-catalog/products";
import { missingFor, planName, requestName, requirementsFor, type SalesRequest } from "../../../sim/30-market/market";
import { nodeCapacity, nodeUsed } from "../../../sim/60-infra/cluster";
import type { GameState } from "../../../sim/50-state";
import { decline, quote } from "../../../sim/90-actions/sales";
import { t } from "../../../i18n/en";
import { useFocus, useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import { initials, PRODUCT, stamp } from "../support/labels";
import { PriceField } from "./PriceField";
import "../support/support.css";
import "./sales.css";

type Box = "open" | "waiting" | "unserved" | "won" | "lost";
const OPEN = ["open", "countered", "refused"];
const BOXES: { id: Box; label: string; icon: typeof Inbox; match: (s: GameState, r: SalesRequest) => boolean }[] = [
  { id: "open", label: "Requests", icon: Inbox, match: (s, r) => OPEN.includes(r.status) && !missingFor(s, r).length },
  { id: "waiting", label: "Awaiting reply", icon: Hourglass, match: (_, r) => r.status === "quoted" },
  { id: "unserved", label: "Cannot serve", icon: Ban, match: (s, r) => r.status === "open" && missingFor(s, r).length > 0 },
  { id: "won", label: "Won", icon: CircleCheck, match: (_, r) => r.status === "won" },
];
const STATUS: Record<SalesRequest["status"], string> = {
  open: "New", quoted: "Quoted", countered: "Counter-offer", refused: "Refused", won: "Won", lost: "Lost", declined: "Declined",
};
const SLA_LABEL = { basic: "Basic", business: "Business", premium: "Premium" } as const;

const need = (r: SalesRequest) => `${planName(r)} · ${r.city}${r.sla === "basic" ? "" : ` · ${SLA_LABEL[r.sla]} SLA`}`;

export function SalesApp() {
  const game = useStore((s) => s.game);
  const [box, setBox] = useState<Box>("open");
  const [sel, setSel] = useState<string | null>(null);
  const requests = game.sales.requests;
  useFocus("Sales", (f) => {
    const r = requests.find((x) => x.id === f.id);
    if (f.kind !== "request" || !r) return;
    setBox(BOXES.find((b) => b.match(game, r))?.id ?? "open");
    setSel(r.id);
  });
  const list = box === "lost" ? [] : requests.filter((r) => BOXES.find((b) => b.id === box)!.match(game, r))
    .sort((a, b) => (box === "won" ? b.createdAt - a.createdAt : a.deadline - b.deadline));
  const current = requests.find((r) => r.id === sel) ?? null;

  return (
    <div className={`sup sales${box === "lost" ? " sales-wide" : ""}`}>
      <aside className="sidebar sup-side">
        <div className="side-h">Sales</div>
        {BOXES.map((b) => (
          <button key={b.id} className={`side-item${box === b.id ? " active" : ""}`} onClick={() => setBox(b.id)}>
            <b.icon />{b.label}<span className="side-count">{requests.filter((r) => b.match(game, r)).length}</span>
          </button>
        ))}
        <button className={`side-item${box === "lost" ? " active" : ""}`} onClick={() => setBox("lost")}>
          <TrendingDown />Lost sales<span className="side-count">{game.sales.lost.length}</span>
        </button>
      </aside>

      {box === "lost" ? <LostSales /> : (
        <>
          <div className="sup-list" role="list">
            <div className="sup-list-h"><h2>{BOXES.find((b) => b.id === box)!.label}</h2></div>
            {list.map((r) => (
              <button key={r.id} role="listitem" className={`tk${r.id === sel ? " active" : ""}${box === "unserved" ? " greyed" : ""}`} onClick={() => setSel(r.id)}>
                <span className="who"><span>{requestName(r)}</span></span>
                <Deadline r={r} hour={game.hour} />
                <span className="subj">{need(r)}</span>
                <span className="meta">
                  <span className="type">{PRODUCT[r.product]}{r.kind === "expansion" && " · Expansion"}</span>
                  {r.status !== "open" && <span className={`pill ${r.status === "countered" ? "accent" : r.status === "won" ? "ok" : ""}`}>{STATUS[r.status]}</span>}
                </span>
              </button>
            ))}
            {!list.length && <div className="sup-none">No requests</div>}
          </div>
          {current ? <Card key={current.id} r={current} /> : <div className="sup-detail sup-none">No request selected</div>}
        </>
      )}
    </div>
  );
}

function Deadline({ r, hour }: { r: SalesRequest; hour: number }) {
  if (!OPEN.includes(r.status)) return <span className="sla num">{stamp(r.createdAt)}</span>;
  const left = r.deadline - hour;
  return <span className={`sla ${left <= 12 ? "warn" : ""}`}><span className="num">{Math.max(0, left)}</span> h left</span>;
}

// The target cluster's booked share before and after this request, per resource.
function Bars({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const zones = game.locations.filter((l) => l.city === r.city).map((l) => l.az);
  const cluster = game.clusters.find((c) => zones.includes(c.az) && c.nodes.length);
  const size = planOf(r.product, r.plan).size(yearOf(game.hour));
  if (!cluster || !size.vcpu && !size.ramGb && !size.diskGb) return null;
  const cap = { vcpu: 0, ramGb: 0, diskGb: 0 }, used = { ...cap };
  for (const n of cluster.nodes) {
    const d = game.devices.find((x) => x.id === n.deviceId);
    if (!d || n.state !== "active") continue;
    const c = nodeCapacity(d), u = nodeUsed(game, d.id);
    for (const k of ["vcpu", "ramGb", "diskGb"] as const) { cap[k] += c[k]; used[k] += u[k]; }
  }
  // An expansion frees the service it replaces.
  const old = r.kind === "expansion" && r.serviceId ? game.workloads.find((w) => w.serviceId === r.serviceId && w.clusterId === cluster.id) : undefined;
  const rows: [string, "vcpu" | "ramGb" | "diskGb", string][] = [["CPU", "vcpu", "vCPU"], ["RAM", "ramGb", "GB"], ["Storage", "diskGb", "GB"]];
  const cls = (x: number) => (x >= 0.9 ? "bad" : x >= 0.7 ? "warn" : "ok");
  return (
    <section className="sales-bars">
      <h3>{cluster.name} · {cluster.az}</h3>
      {rows.map(([label, k, unit]) => {
        const before = cap[k] ? used[k] / cap[k] : 1, after = cap[k] ? (used[k] - (old?.[k] ?? 0) + size[k]) / cap[k] : 1;
        return (
          <div key={k} className="res">
            <span className="res-k">{label}</span>
            <span className="res-bar" role="img" aria-label={`${label} ${Math.round(before * 100)}% now, ${Math.round(after * 100)}% after`}>
              <i className={`after ${cls(after)}`} style={{ width: `${Math.min(100, after * 100)}%` }} />
              <i className="before" style={{ width: `${Math.min(100, before * 100)}%` }} />
            </span>
            <span className="res-v num">{Math.round(size[k] * 10) / 10} {unit}</span>
            <span className={`res-p num ${after > 1 ? "over" : ""}`}>{Math.round(after * 100)}%</span>
          </div>
        );
      })}
    </section>
  );
}

function Card({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [price, setPrice] = useState(r.counter ?? r.quote ?? r.reference);
  const reqs = requirementsFor(game, r), missing = reqs.filter((x) => !x.ok);
  const sla = SLAS[r.sla];
  const canQuote = OPEN.includes(r.status) && !missing.length;
  const customer = r.customerId ? game.customers.find((c) => c.id === r.customerId) : undefined;

  return (
    <div className={`sup-detail${missing.length && OPEN.includes(r.status) ? " greyed" : ""}`}>
      <div className="d-head">
        <div className="top"><h2>{planName(r)}{r.kind === "expansion" && " expansion"}</h2><span className="id num">#{r.id.slice(3)}</span></div>
        <div className="facts">
          <span className="type">{PRODUCT[r.product]}</span>
          <span>{r.city}</span>
          <span>{SLA_LABEL[r.sla]} SLA · <span className="num">{(sla.uptime * 100).toFixed(sla.uptime >= 0.999 ? 2 : 1)}%</span> · <span className="num">{sla.responseHours}</span> h response</span>
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

      {!missing.length && <Bars r={r} />}

      <div className="thread">
        {r.thread.map((m, i) => (
          <div key={i} className={`msg${m.from === "you" ? " you" : ""}`}>
            <div className="from">{m.from === "you" ? "You" : r.contact} · <span className="num">{stamp(m.hour)}</span></div>
            <p>{t(m.key, m.params)}</p>
          </div>
        ))}
        {r.status === "quoted" && <div className="event"><span>Awaiting reply</span></div>}
      </div>

      {canQuote && (
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

function LostSales() {
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
              <td>{planOf(l.product, l.plan).name}</td>
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
