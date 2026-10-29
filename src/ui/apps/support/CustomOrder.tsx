import { Check, CircleX, Globe, Rocket, Send, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import type { Resources } from "../../../sim/10-catalog/products";
import type { Product } from "../../../sim/30-customers/customers";
import { registryCost, registryOf } from "../../../sim/30-customers/registry";
import { setupFee, sizeOf } from "../../../sim/30-market/spec";
import { invoiceOf, stepsDone } from "../../../sim/30-market/manual";
import type { SalesRequest } from "../../../sim/30-market/market";
import { isFinal, type Ticket } from "../../../sim/40-support/tickets";
import { routeOptions } from "../../../sim/60-infra/routes";
import { acceptUpgrade, confirmOrder, createAccount, provisionOrder, registerOrderDomain } from "../../../sim/90-actions/orders";
import { decline } from "../../../sim/90-actions/sales";
import { closeTicket } from "../../../sim/90-actions/support";
import { useStore } from "../../store";
import { PriceField } from "../sales/PriceField";
import "./custom-order.css";

const n = (x: number) => Math.round(x * 100) / 100;
const gb = (x: number) => `${n(x)} GB`;

const free = (r: Resources) => `${n(r.vcpu)} vCPU · ${gb(r.ramGb)} RAM · ${gb(r.diskGb)} disk free`;

// Where the service goes: automatic, a cluster in the city or one of its servers, with what each can still book.
export function RouteCards({ product, city, size, value, onChange, disabled }: {
  product: Product; city: string; size: Resources; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const game = useStore((s) => s.game);
  const clusters = routeOptions(game, product, city, size), name = useId();
  const card = (id: string, title: string, sub: string, fits: boolean, nested = false) => (
    <label key={id} className={`route${nested ? " node" : ""}${fits ? "" : " full"}`}>
      <input type="radio" name={name} checked={value === id} disabled={disabled} onChange={() => onChange(id)} />
      <span className="route-t">{title}{!fits && <span className="pill">Full</span>}</span>
      <span className="route-s num">{sub}</span>
    </label>
  );
  return (
    <div className="routes" role="radiogroup" aria-label="Target">
      {card("auto", "Automatic", `${clusters.length} cluster${clusters.length === 1 ? "" : "s"} in ${city}`, clusters.some((c) => c.fits))}
      {clusters.flatMap((c) => [
        card(c.id, `${c.name} · ${c.az}`, free(c.free), c.fits),
        ...c.nodes.map((d) => card(d.id, d.name, free(d.free), d.fits, true)),
      ])}
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

// The steps of a custom order, each with its button once the step before it is done.
export function CustomCompose({ tk, r }: { tk: Ticket; r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [price, setPrice] = useState(r.quote ?? r.reference);
  const fee = setupFee(game, r.product), [setup, setSetup] = useState(r.setup ?? fee);
  const [route, setRoute] = useState(r.route ?? "auto");
  if (isFinal(tk)) return null;
  const done = stepsDone(game, r), locked = !!tk.work;
  const web = r.product === "webHosting" && !!r.domain;
  const current = !done.account ? "account" : !done.invoice ? "invoice" : !done.domain ? "domain" : !done.provision ? "provision" : null;
  const cost = web ? registryCost(r.domain!, yearOf(game.hour)) : 0;
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
        {row("account", "Customer account", done.account ? "Created" : "None",
          <button className="btn primary" disabled={locked} onClick={() => act((s) => createAccount(s, tk.id))}><UserPlus />Create customer account</button>)}
        {row("invoice", "Order confirmation", done.invoice ? `${euroCents(r.quote ?? 0)} a month` : "Not sent",
          <div className="step-row">
            <PriceField value={price} reference={r.reference} onChange={setPrice} disabled={locked} />
            <PriceField value={setup} reference={fee} onChange={setSetup} disabled={locked} label="Setup fee" />
            <button className="btn primary" disabled={locked || !(price > 0) || !(setup >= 0)} onClick={() => act((s) => confirmOrder(s, tk.id, price, setup))}><Send />Confirm order and send invoice</button>
          </div>)}
        {web && row("domain", r.owned ? "Domain transfer" : "Domain", done.domain ? "Registered" : `${r.domain} · ${registryOf(r.domain!).name} · ${euroCents(cost)} a year`,
          <button className="btn primary" disabled={locked} onClick={() => act((s) => registerOrderDomain(s, tk.id))}><Globe />{r.owned ? "Transfer domain" : "Register domain"}</button>)}
        {row("provision", "Setup", done.provision ? "Live" : "Not set up",
          <div className="step-col">
            <RouteCards product={r.product} city={r.city} size={sizeOf(r.spec!)} value={route} onChange={setRoute} disabled={locked} />
            <button className="btn primary" disabled={locked} onClick={() => act((s) => provisionOrder(s, tk.id, route))}><Rocket />{PROVISION[r.product]}</button>
          </div>)}
      </ol>
      <div className="actions-row">
        <button className="btn ghost" disabled={locked} onClick={() => act((s) => closeTicket(s, tk.id))}><CircleX />Decline</button>
      </div>
    </div>
  );
}

// An upgrade of a custom service: current and requested resources, the new monthly price and where it grows.
export function UpgradeCompose({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const v = game.services.find((x) => x.id === r.serviceId);
  const [price, setPrice] = useState(r.counter ?? r.reference);
  const [route, setRoute] = useState("auto");
  if (!v?.spec || !r.spec) return null;
  const current = v.price * 730, open = ["open", "countered", "refused"].includes(r.status);
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
      {open && (
        <div className="compose custom-steps">
          <PriceField value={price} reference={r.reference} onChange={setPrice} label="New monthly price" />
          <span className="sales-total">Difference <span className="num">{price >= current ? "+" : ""}{euroCents(price - current)}</span> a month</span>
          <RouteCards product={r.product} city={r.city} size={sizeOf(r.spec)} value={route} onChange={setRoute} />
          <div className="actions-row">
            <button className="btn ghost" onClick={() => act((s) => decline(s, r.id))}><CircleX />Decline</button>
            <span className="grow" />
            <button className="btn primary" disabled={!(price > 0)} onClick={() => act((s) => acceptUpgrade(s, r.id, price, route))}><Check />Accept</button>
          </div>
        </div>
      )}
    </>
  );
}
