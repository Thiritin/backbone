import { Check, CircleX, FilePlus, FileText, Globe, Receipt, Rocket, Send, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { t } from "../../../i18n/en";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import type { Resources } from "../../../sim/10-catalog/products";
import type { Product } from "../../../sim/30-customers/customers";
import { registryCost, registryOf } from "../../../sim/30-customers/registry";
import { wholesale } from "../../../sim/30-customers/registrar";
import { sizeOf } from "../../../sim/30-market/spec";
import { canAutomate, hostFor, invoiceOf, shopRegisters, stepsDone } from "../../../sim/30-market/manual";
import { registrarFormUrl } from "../../../sim/80-business/browser";
import type { SalesRequest } from "../../../sim/30-market/market";
import { isFinal, type Ticket } from "../../../sim/40-support/tickets";
import type { InvoiceStatus } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { betterHost, hostQuality, routeOptions } from "../../../sim/60-infra/routes";
import { attachQuote, createQuote, invoiceOrder, offerUpgrade, provisionOrder, registerOrderDomain } from "../../../sim/90-actions/orders";
import { hasHelpdeskLink } from "../../../sim/30-market/quotes";
import { QUOTE_DRAG, QuotePill } from "../books/QuotesTab";
import { decline } from "../../../sim/90-actions/sales";
import { closeTicket } from "../../../sim/90-actions/support";
import { useStore } from "../../store";
import { createFormFor, createLink } from "../../../sim/80-business/consoles";
import { familyOf } from "../../../sim/60-infra/vulns";
import { PriceField } from "../sales/PriceField";
import "./custom-order.css";

const n = (x: number) => Math.round(x * 100) / 100;
const gb = (x: number) => `${n(x)} GB`;

const free = (r: Resources) => `${n(r.vcpu)} vCPU · ${gb(r.ramGb)} RAM · ${gb(r.diskGb)} disk free`;

const LOAD: [string, "vcpu" | "ramGb" | "diskGb", string][] = [["CPU", "vcpu", "vCPU"], ["RAM", "ramGb", "GB"], [t("support.storage"), "diskGb", "GB"]];
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
            <span className="res-bar" role="img" aria-label={t("support.loadBar", { label, before: Math.round(before * 100), after: Math.round(after * 100) })}>
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

// The servers of the city that can run the product: each node, or a VM cluster as a whole, with what it can still book
// and the load of the chosen one. An upgrade frees the service it replaces wherever that runs now.
function servers(game: GameState, product: Product, city: string, size: Resources) {
  return routeOptions(game, product, city, size).flatMap((c) =>
    game.clusters.find((x) => x.id === c.id)?.vm ? [{ ...c, title: `${c.name} · ${c.az}` }] : c.nodes.map((d) => ({ ...d, title: `${d.name} · ${c.name}` })));
}

// The server an upgrade grows on by default: the one it runs on now, else the first with room.
function defaultServer(game: GameState, r: SalesRequest): string {
  if (r.route && r.route !== "auto") return r.route;
  const list = servers(game, r.product, r.city, sizeOf(r.spec!)), old = game.workloads.find((w) => w.serviceId === r.serviceId);
  return (list.find((x) => x.id === old?.deviceId || x.id === old?.clusterId) ?? list.find((x) => x.fits) ?? list[0])?.id ?? "";
}

export function RouteCards({ product, city, size, value, onChange, disabled, serviceId }: {
  product: Product; city: string; size: Resources; value: string; onChange: (v: string) => void; disabled?: boolean; serviceId?: string;
}) {
  const game = useStore((s) => s.game);
  const list = servers(game, product, city, size), name = useId();
  const old = serviceId ? game.workloads.find((w) => w.serviceId === serviceId) : undefined;
  const target = list.find((x) => x.id === value);
  const holds = !!target && (old?.deviceId === target.id || (!old?.deviceId && old?.clusterId === target.id));
  const used = old && target && holds ? { vcpu: target.used.vcpu - old.vcpu, ramGb: target.used.ramGb - old.ramGb, diskGb: target.used.diskGb - old.diskGb } : target?.used;
  return (
    <>
      <div className="routes" role="radiogroup" aria-label={t("support.server")}>
        {list.map((x) => (
          <label key={x.id} className={`route${x.fits ? "" : " full"}`}>
            <input type="radio" name={name} checked={value === x.id} disabled={disabled} onChange={() => onChange(x.id)} />
            <span className="route-t">{x.title}{!x.fits && <span className="pill">{t("support.full")}</span>}</span>
            <span className="route-s num">{free(x.free)}</span>
          </label>
        ))}
      </div>
      {target && used && (size.vcpu || size.ramGb || size.diskGb) ? <Load title={target.title} cap={target.cap} used={used} size={size} /> : null}
    </>
  );
}

// The hosts of the city that can run the product, best first, each with its hardware and what is booked on it against what
// it holds. The suggested one is preselected by the order; the player still sets the order up. Automatic joins them once the
// provisioning skill is learned.
function HostCards({ r, value, onChange, disabled }: { r: SalesRequest; value: string | null; onChange: (v: string) => void; disabled?: boolean }) {
  const game = useStore((s) => s.game);
  const better = betterHost(game), suggested = hostFor(game, r);
  const hosts = routeOptions(game, r.product, r.city, sizeOf(r.spec!)).sort((a, b) => Number(b.fits) - Number(a.fits) || better(game.clusters.find((c) => c.id === a.id)!, game.clusters.find((c) => c.id === b.id)!));
  const used = (h: (typeof hosts)[number], k: "ramGb" | "diskGb") => t("support.ofGb", { a: n(h.used[k]), b: n(h.cap[k]) });
  const card = (id: string, title: string, fits: boolean, rows: [string, string][]) => (
    <div key={id} className={`host${value === id ? " sel" : ""}${fits ? "" : " full"}`}>
      <span className="host-t">{title}{!fits && <span className="pill">{t("support.full")}</span>}{id === suggested && <span className="pill accent">{t("support.suggested")}</span>}</span>
      {rows.map(([k, v]) => <span key={k} className="host-r"><span>{k}</span><span className="num">{v}</span></span>)}
      <button className="btn" aria-pressed={value === id} disabled={disabled || !fits} onClick={() => onChange(id)}>{value === id ? t("support.selected") : t("support.select")}</button>
    </div>
  );
  return (
    <div className="hosts" role="group" aria-label={t("support.hosts")}>
      {canAutomate(game) && card("auto", t("support.automatic"), hosts.some((h) => h.fits), [[t("support.hosts"), String(hosts.length)]])}
      {hosts.map((h) => {
        const q = hostQuality(game, game.clusters.find((c) => c.id === h.id)!);
        return card(h.id, `${h.name} · ${h.az}`, h.fits, [[t("support.hardware"), q.year ? String(q.year) : t("support.unknown")], [t("support.downThisMonth"), `${n(q.down)} h`], [t("support.ramBooked"), used(h, "ramGb")], [t("support.diskBooked"), used(h, "diskGb")]]);
      })}
    </div>
  );
}

// The ticket's attachments: the quotes sent onto it. A quote row dragged here from Books is sent to the customer; with the
// Helpdesk link the strip has Create quote, which opens the quote in Books.
function Attachments({ tk, locked, open }: { tk: Ticket; locked: boolean; open: boolean }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const openApp = useStore((s) => s.openApp);
  const [over, setOver] = useState(false);
  const takes = (e: React.DragEvent) => open && !locked && e.dataTransfer.types.includes(QUOTE_DRAG);
  const sent = game.quotes.filter((q) => q.ticketId === tk.id && q.status !== "draft");
  return (
    <div className={`attach-strip${over ? " over" : ""}`} aria-label={t("orderSteps.attachments")}
      onDragOver={(e) => { if (!takes(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); const id = e.dataTransfer.getData(QUOTE_DRAG); if (takes(e) && id) { e.preventDefault(); act(attachQuote, id, tk.id); } }}>
      <span className="attach-k">{t("orderSteps.attachments")}</span>
      {sent.map((q) => (
        <button key={q.id} className="attach-chip" onClick={() => openApp("Books", { kind: "quote", id: q.id })}><FileText />{t("orderSteps.quote", { number: q.number })}<QuotePill q={q} /></button>
      ))}
      {open && hasHelpdeskLink(game) && (
        <button className="btn primary" disabled={locked} onClick={() => { const r = act(createQuote, tk.id); if (r.ok) openApp("Books", { kind: "quote", id: r.id! }); }}><FilePlus />{t("orderSteps.createQuote")}</button>
      )}
    </div>
  );
}

const PROVISION: Partial<Record<Product, string>> = { webHosting: t("support.provisionWeb"), vps: t("support.provisionVps"), gameServer: t("support.provisionGame") };
const INVOICE: Record<InvoiceStatus, { label: string; pill: string }> = {
  draft: { label: t("books.status.draft"), pill: "" },
  open: { label: t("support.invoice.open"), pill: "accent" }, overdue: { label: t("support.invoice.overdue"), pill: "warn" }, paid: { label: t("support.invoice.paid"), pill: "ok" }, writtenOff: { label: t("support.invoice.writtenOff"), pill: "" },
};

export function InvoicePill({ r }: { r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const inv = invoiceOf(game, r);
  if (!inv) return null;
  const st = INVOICE[inv.status];
  return <span className={`pill ${st.pill}`}>{t("support.invoicePill", { number: inv.number, status: st.label })}</span>;
}

// The steps of a custom order, each with its button once the step before it is done. Order form orders start accepted.
export function CustomCompose({ tk, r }: { tk: Ticket; r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const openApp = useStore((s) => s.openApp);
  const [route, setRoute] = useState<string | null>(() => r.route ?? hostFor(game, r));
  const host = route ? game.clusters.find((x) => x.id === route) : undefined;
  const link = host && createFormFor(familyOf(host), r.product) ? createLink(game, host.id, tk.id) : null;
  if (isFinal(tk)) return null;
  const done = stepsDone(game, r), locked = !!tk.work;
  // An accepted quote is carried forward to the first invoice in Books.
  const accepted = game.quotes.find((q) => q.ticketId === tk.id && q.status === "accepted");
  const web = r.product === "webHosting" && !!r.domain;
  const current = !done.quote ? "quote" : !done.account ? "account" : !done.invoice ? "invoice" : !done.domain ? "domain" : !done.provision ? "provision" : null;
  const cost = web ? (game.registrar ? wholesale(game, r.domain!) : registryCost(r.domain!, yearOf(game.hour))) : 0;
  const waiting = r.replyAt !== null;
  const quoteValue = done.quote ? t("support.perMonth", { price: euroCents(r.quote ?? 0) }) : waiting ? t("support.sent") : r.status === "countered" ? t("support.counter", { price: euroCents(r.counter ?? 0) }) : r.status === "refused" ? t("support.refused") : t("support.notSent");
  const row = (id: string, label: string, value: string, body?: React.ReactNode) => (
    <li key={id} className={`step${done[id as keyof typeof done] ? " done" : id === current ? " now" : ""}`}>
      <span className="step-i">{done[id as keyof typeof done] ? <Check aria-label={t("support.done")} /> : null}</span>
      <span className="step-k">{label}</span>
      <span className="step-v">{value}</span>
      {id === current && body && <div className="step-body">{body}</div>}
    </li>
  );
  return (
    <div className="compose custom-steps">
      <ol className="steps">
        {!r.form && row("quote", t("support.quote"), quoteValue, <Attachments tk={tk} locked={locked} open={!waiting} />)}
        {row("account", t("support.customerAccount"), done.account ? t("support.created") : t("support.none"),
          <button className="btn primary" disabled={locked} onClick={() => openApp("Books", { kind: "newCustomer", id: tk.id })}><UserPlus />{t("orderSteps.createCustomer")}</button>)}
        {row("invoice", t("support.orderConfirmation"), done.invoice ? t("support.perMonth", { price: euroCents(r.quote ?? 0) }) : invoiceOf(game, r) ? t("orderSteps.status.draft") : t("support.notSent"),
          accepted && !invoiceOf(game, r)
            ? <button className="btn primary" disabled={locked} onClick={() => openApp("Books", { kind: "quote", id: accepted.id })}><FileText />{t("orderSteps.quote", { number: accepted.number })}</button>
            : <button className="btn primary" disabled={locked} onClick={() => { const res = act(invoiceOrder, tk.id); if (res.ok) openApp("Books", { kind: "invoice", id: res.id! }); }}><Receipt />{t("orderSteps.openInvoice")}</button>)}
        {web && row("domain", r.owned ? t("support.domainTransfer") : t("support.domain"), done.domain ? t("support.registered") : t("support.domainLine", { domain: r.domain!, registry: registryOf(r.domain!).name, price: euroCents(cost) }),
          <button className="btn primary" disabled={locked} onClick={() => (shopRegisters(game, r) ? act(registerOrderDomain, tk.id) : openApp("Browser", { kind: "url", id: registrarFormUrl(game, tk.id, !!r.owned) }))}><Globe />{r.owned ? t("support.transferDomain") : t("support.registerDomain")}</button>)}
        {row("provision", t("support.setup"), done.provision ? t("support.live") : t("support.notSetUp"),
          <div className="step-col">
            <HostCards r={r} value={route} onChange={setRoute} disabled={locked} />
            {link
              ? <button className="btn primary" disabled={locked} onClick={() => openApp("Browser", { kind: "url", id: `http://${link}` })}><Rocket />{t("pkg.openForm")}</button>
              : <button className="btn primary" disabled={locked || !route} onClick={() => act(provisionOrder, tk.id, route!)}><Rocket />{PROVISION[r.product]}</button>}
          </div>)}
      </ol>
      <div className="actions-row">
        <button className="btn ghost" disabled={locked} onClick={() => act(closeTicket, tk.id)}><CircleX />{t("support.decline")}</button>
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
  const [route, setRoute] = useState(() => defaultServer(game, r));
  if (!v?.spec || !r.spec) return null;
  const current = v.price * 730, open = ["open", "countered", "refused"].includes(r.status), locked = r.status === "quoted";
  const rows: [string, number, number, string][] = r.product === "webHosting"
    ? [[t("support.space"), v.spec.diskGb, r.spec.diskGb, "GB"], [t("support.traffic"), v.spec.trafficGb, r.spec.trafficGb, "GB"], [t("support.mailboxes"), v.spec.mailboxes, r.spec.mailboxes, ""]]
    : [["vCPU", v.spec.vcpu, r.spec.vcpu, ""], ["RAM", v.spec.ramGb, r.spec.ramGb, "GB"], [t("support.disk"), v.spec.diskGb, r.spec.diskGb, "GB"]];
  return (
    <>
      <table className="table upgrade-table">
        <thead><tr><th>{t("support.resource")}</th><th className="r">{t("support.now")}</th><th className="r">{t("support.requested")}</th></tr></thead>
        <tbody>
          {rows.map(([k, a, b, u]) => <tr key={k}><td>{k}</td><td className="r num">{n(a)} {u}</td><td className="r num">{n(b)} {u}</td></tr>)}
          <tr><td>{t("support.monthlyPrice")}</td><td className="r num">{euroCents(current)}</td><td className="r num">{euroCents(price)}</td></tr>
        </tbody>
      </table>
      {(open || locked) && (
        <div className="compose custom-steps">
          <PriceField value={price} reference={r.reference} onChange={setPrice} disabled={locked} label={t("support.newMonthlyPrice")} />
          <span className="sales-total">{t("support.difference", { amount: `${price >= current ? "+" : ""}${euroCents(price - current)}` })}</span>
          <RouteCards product={r.product} city={r.city} size={sizeOf(r.spec)} value={route} onChange={setRoute} disabled={locked} serviceId={r.serviceId ?? undefined} />
          <div className="actions-row">
            <button className="btn ghost" disabled={locked} onClick={() => act(decline, r.id)}><CircleX />{t("support.decline")}</button>
            <span className="grow" />
            <button className="btn primary" disabled={locked || !(price > 0) || !route} onClick={() => act(offerUpgrade, r.id, price, route)}><Send />{t("support.sendOffer")}</button>
          </div>
        </div>
      )}
    </>
  );
}
