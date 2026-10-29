import { Check, CircleX, Globe, Rocket, Send, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import type { Resources } from "../../../sim/10-catalog/products";
import type { Product } from "../../../sim/30-customers/customers";
import { registryCost, registryOf } from "../../../sim/30-customers/registry";
import { wholesale } from "../../../sim/30-customers/registrar";
import { setupFee, sizeOf } from "../../../sim/30-market/spec";
import { canAutomate, invoiceOf, stepsDone } from "../../../sim/30-market/manual";
import type { SalesRequest } from "../../../sim/30-market/market";
import { isFinal, type Ticket } from "../../../sim/40-support/tickets";
import { routeOptions, sumOf } from "../../../sim/60-infra/routes";
import { offerUpgrade, confirmOrder, createAccount, provisionOrder, quoteOrder, registerOrderDomain } from "../../../sim/90-actions/orders";
import { decline } from "../../../sim/90-actions/sales";
import { closeTicket } from "../../../sim/90-actions/support";
import { useStore } from "../../store";
import { PriceField } from "../sales/PriceField";
import "./custom-order.css";

const n = (x: number) => Math.round(x * 100) / 100;
const gb = (x: number) => `${n(x)} GB`;

const free = (r: Resources) => `${n(r.vcpu)} vCPU · ${gb(r.ramGb)} RAM · ${gb(r.diskGb)} disk free`;

const LOAD: [string, "vcpu" | "ramGb" | "diskGb", string][] = [["CPU", "vcpu", "vCPU"], ["RAM", "ramGb", "GB"], ["Storage", "diskGb", "GB"]];
const tone = (x: number) => (x >= 0.9 ? "bad" : x >= 0.7 ? "warn" : "ok");

// What a target has booked now and once the service lands on it.
function Load({ title, cap, used, size }: { title: string; cap: Resources; used: Resources; size: Resources }) {
  return (
    <section className="sales-bars route-load">
      <h3>{title}</h3>
      {LOAD.map(([label, k, unit]) => {
        const before = cap[k] ? used[k] / cap[k] : 1, after = cap[k] ? (used[k] + size[k]) / cap[k] : 1;
        return (
          <div key={k} className="res">
            <span className="res-k">{label}</span>
            <span className="res-bar" role="img" aria-label={`${label} ${Math.round(before * 100)}% now, ${Math.round(after * 100)}% after`}>
              <i className={`after ${tone(after)}`} style={{ width: `${Math.min(100, after * 100)}%` }} />
              <i className="before" style={{ width: `${Math.min(100, before * 100)}%` }} />
            </span>
            <span className="res-v num">{n(size[k])} {unit}</span>
            <span className={`res-p num ${after > 1 ? "over" : ""}`}>{Math.round(after * 100)}%</span>
          </div>
        );
      })}
    </section>
  );
}

// Where the service goes: automatic, a cluster in the city or one of its servers, with what each can still book and the
// load of the chosen one. An upgrade frees the service it replaces wherever that runs now.
export function RouteCards({ product, city, size, value, onChange, disabled, serviceId }: {
  product: Product; city: string; size: Resources; value: string; onChange: (v: string) => void; disabled?: boolean; serviceId?: string;
}) {
  const game = useStore((s) => s.game);
  const clusters = routeOptions(game, product, city, size), name = useId();
  const old = serviceId ? game.workloads.find((w) => w.serviceId === serviceId) : undefined;
  const card = (id: string, title: string, sub: string, fits: boolean, nested = false) => (
    <label key={id} className={`route${nested ? " node" : ""}${fits ? "" : " full"}`}>
      <input type="radio" name={name} checked={value === id} disabled={disabled} onChange={() => onChange(id)} />
      <span className="route-t">{title}{!fits && <span className="pill">Full</span>}</span>
      <span className="route-s num">{sub}</span>
    </label>
  );
  const picked = clusters.find((c) => c.id === value), node = clusters.flatMap((c) => c.nodes).find((d) => d.id === value);
  const target = picked ? { title: `${picked.name} · ${picked.az}`, ...picked, holds: old?.clusterId === picked.id }
    : node ? { title: node.name, ...node, holds: old?.deviceId === node.id }
    : { title: city, cap: sumOf(clusters.map((c) => c.cap)), used: sumOf(clusters.map((c) => c.used)), holds: clusters.some((c) => c.id === old?.clusterId) };
  const used = old && target.holds ? { vcpu: target.used.vcpu - old.vcpu, ramGb: target.used.ramGb - old.ramGb, diskGb: target.used.diskGb - old.diskGb } : target.used;
  return (
    <>
      <div className="routes" role="radiogroup" aria-label="Target">
        {card("auto", "Automatic", `${clusters.length} cluster${clusters.length === 1 ? "" : "s"} in ${city}`, clusters.some((c) => c.fits))}
        {clusters.flatMap((c) => [
          card(c.id, `${c.name} · ${c.az}`, free(c.free), c.fits),
          ...c.nodes.map((d) => card(d.id, d.name, free(d.free), d.fits, true)),
        ])}
      </div>
      {clusters.length > 0 && (size.vcpu || size.ramGb || size.diskGb) ? <Load title={target.title} cap={target.cap} used={used} size={size} /> : null}
    </>
  );
}

// The hosts of the city that can run the product, each with what is booked on it against what it holds. Automatic joins
// them once the provisioning skill is learned.
function HostCards({ r, value, onChange, disabled }: { r: SalesRequest; value: string | null; onChange: (v: string) => void; disabled?: boolean }) {
  const game = useStore((s) => s.game);
  const hosts = routeOptions(game, r.product, r.city, sizeOf(r.spec!));
  const used = (h: (typeof hosts)[number], k: "ramGb" | "diskGb") => `${n(h.used[k])} of ${n(h.cap[k])} GB`;
  const card = (id: string, title: string, fits: boolean, rows: [string, string][]) => (
    <div key={id} className={`host${value === id ? " sel" : ""}${fits ? "" : " full"}`}>
      <span className="host-t">{title}{!fits && <span className="pill">Full</span>}</span>
      {rows.map(([k, v]) => <span key={k} className="host-r"><span>{k}</span><span className="num">{v}</span></span>)}
      <button className="btn" aria-pressed={value === id} disabled={disabled || !fits} onClick={() => onChange(id)}>{value === id ? "Selected" : "Select"}</button>
    </div>
  );
  return (
    <div className="hosts" role="group" aria-label="Hosts">
      {canAutomate(game) && card("auto", "Automatic", hosts.some((h) => h.fits), [["Hosts", String(hosts.length)]])}
      {hosts.map((h) => card(h.id, `${h.name} · ${h.az}`, h.fits, [["RAM booked", used(h, "ramGb")], ["Disk booked", used(h, "diskGb")]]))}
    </div>
  );
}

// The price and setup fee of the quote; it starts over with the counter-offer after each answer.
function QuoteFields({ tk, r, locked }: { tk: Ticket; r: SalesRequest; locked: boolean }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const fee = setupFee(game, r.product);
  const [price, setPrice] = useState(r.counter ?? r.quote ?? r.reference), [setup, setSetup] = useState(r.setup ?? fee);
  return (
    <div className="step-row">
      <PriceField value={price} reference={r.reference} onChange={setPrice} disabled={locked} />
      <PriceField value={setup} reference={fee} onChange={setSetup} disabled={locked} label="Setup fee" />
      <button className="btn primary" disabled={locked || !(price > 0) || !(setup >= 0)} onClick={() => act(quoteOrder, tk.id, price, setup)}><Send />Send quote</button>
    </div>
  );
}

const PROVISION: Partial<Record<Product, string>> = { webHosting: "Provision web hosting", vps: "Provision VPS", gameServer: "Provision game server" };
const INVOICE: Record<string, { label: string; pill: string }> = {
  open: { label: "Open", pill: "accent" }, overdue: { label: "Overdue", pill: "warn" }, paid: { label: "Paid", pill: "ok" }, writtenOff: { label: "Written off", pill: "" },
};

export function InvoicePill({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const inv = invoiceOf(game, r);
  if (!inv) return null;
  const st = INVOICE[inv.status];
  return <span className={`pill ${st.pill}`}>Invoice <span className="num">{inv.number}</span> · {st.label}</span>;
}

// The steps of a custom order, each with its button once the step before it is done. Order form orders start accepted.
export function CustomCompose({ tk, r }: { tk: Ticket; r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [route, setRoute] = useState<string | null>(r.route ?? null);
  if (isFinal(tk)) return null;
  const done = stepsDone(game, r), locked = !!tk.work;
  const web = r.product === "webHosting" && !!r.domain;
  const current = !done.quote ? "quote" : !done.account ? "account" : !done.invoice ? "invoice" : !done.domain ? "domain" : !done.provision ? "provision" : null;
  const cost = web ? (game.registrar ? wholesale(game, r.domain!) : registryCost(r.domain!, yearOf(game.hour))) : 0;
  const waiting = r.replyAt !== null;
  const quoteValue = done.quote ? `${euroCents(r.quote ?? 0)} a month` : waiting ? "Sent" : r.status === "countered" ? `Counter ${euroCents(r.counter ?? 0)} a month` : r.status === "refused" ? "Refused" : "Not sent";
  const row = (id: string, label: string, value: string, body?: React.ReactNode) => (
    <li key={id} className={`step${done[id as keyof typeof done] ? " done" : id === current ? " now" : ""}`}>
      <span className="step-i">{done[id as keyof typeof done] ? <Check aria-label="Done" /> : null}</span>
      <span className="step-k">{label}</span>
      <span className="step-v">{value}</span>
      {id === current && body && <div className="step-body">{body}</div>}
    </li>
  );
  return (
    <div className="compose custom-steps">
      <ol className="steps">
        {!r.form && row("quote", "Quote", quoteValue, !waiting && <QuoteFields key={r.attempts} tk={tk} r={r} locked={locked} />)}
        {row("account", "Customer account", done.account ? "Created" : "None",
          <button className="btn primary" disabled={locked} onClick={() => act(createAccount, tk.id)}><UserPlus />Create customer account</button>)}
        {row("invoice", "Order confirmation", done.invoice ? `${euroCents(r.quote ?? 0)} a month` : "Not sent",
          <button className="btn primary" disabled={locked} onClick={() => act(confirmOrder, tk.id)}><Send />Confirm order and send invoice</button>)}
        {web && row("domain", r.owned ? "Domain transfer" : "Domain", done.domain ? "Registered" : `${r.domain} · ${registryOf(r.domain!).name} · ${euroCents(cost)} a year`,
          <button className="btn primary" disabled={locked} onClick={() => act(registerOrderDomain, tk.id)}><Globe />{r.owned ? "Transfer domain" : "Register domain"}</button>)}
        {row("provision", "Setup", done.provision ? "Live" : "Not set up",
          <div className="step-col">
            <HostCards r={r} value={route} onChange={setRoute} disabled={locked} />
            <button className="btn primary" disabled={locked || !route} onClick={() => act(provisionOrder, tk.id, route!)}><Rocket />{PROVISION[r.product]}</button>
          </div>)}
      </ol>
      <div className="actions-row">
        <button className="btn ghost" disabled={locked} onClick={() => act(closeTicket, tk.id)}><CircleX />Decline</button>
      </div>
    </div>
  );
}

// An upgrade of a custom service: current and requested resources, the new monthly price and where it grows.
export function UpgradeCompose({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const v = game.services.find((x) => x.id === r.serviceId);
  const [price, setPrice] = useState(r.counter ?? r.quote ?? r.reference);
  const [route, setRoute] = useState(r.route ?? "auto");
  if (!v?.spec || !r.spec) return null;
  const current = v.price * 730, open = ["open", "countered", "refused"].includes(r.status), locked = r.status === "quoted";
  const rows: [string, number, number, string][] = r.product === "webHosting"
    ? [["Space", v.spec.diskGb, r.spec.diskGb, "GB"], ["Traffic", v.spec.trafficGb, r.spec.trafficGb, "GB"], ["Mailboxes", v.spec.mailboxes, r.spec.mailboxes, ""]]
    : [["vCPU", v.spec.vcpu, r.spec.vcpu, ""], ["RAM", v.spec.ramGb, r.spec.ramGb, "GB"], ["Disk", v.spec.diskGb, r.spec.diskGb, "GB"]];
  return (
    <>
      <table className="table upgrade-table">
        <thead><tr><th>Resource</th><th className="r">Now</th><th className="r">Requested</th></tr></thead>
        <tbody>
          {rows.map(([k, a, b, u]) => <tr key={k}><td>{k}</td><td className="r num">{n(a)} {u}</td><td className="r num">{n(b)} {u}</td></tr>)}
          <tr><td>Monthly price</td><td className="r num">{euroCents(current)}</td><td className="r num">{euroCents(price)}</td></tr>
        </tbody>
      </table>
      {(open || locked) && (
        <div className="compose custom-steps">
          <PriceField value={price} reference={r.reference} onChange={setPrice} disabled={locked} label="New monthly price" />
          <span className="sales-total">Difference <span className="num">{price >= current ? "+" : ""}{euroCents(price - current)}</span> a month</span>
          <RouteCards product={r.product} city={r.city} size={sizeOf(r.spec)} value={route} onChange={setRoute} disabled={locked} serviceId={r.serviceId ?? undefined} />
          <div className="actions-row">
            <button className="btn ghost" disabled={locked} onClick={() => act(decline, r.id)}><CircleX />Decline</button>
            <span className="grow" />
            <button className="btn primary" disabled={locked || !(price > 0)} onClick={() => act(offerUpgrade, r.id, price, route)}><Send />Send offer</button>
          </div>
        </div>
      )}
    </>
  );
}
