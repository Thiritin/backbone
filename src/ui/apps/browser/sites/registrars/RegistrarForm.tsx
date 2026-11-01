import { useEffect, useRef, useState, type CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import type { Registrar } from "../../../../../sim/10-catalog/registrars";
import { addressLines, type Address } from "../../../../../sim/30-customers/addresses";
import { companyDomain } from "../../../../../sim/30-customers/domains";
import { orderChoices, shopRegisters, stepError } from "../../../../../sim/30-market/manual";
import type { GameState } from "../../../../../sim/50-state";
import { registerOrderDomain } from "../../../../../sim/90-actions/orders";
import { OrderPicker } from "../../consoles/PackageForms";
import { REGISTRAR_HUE } from "./RegistrarPage";
import "../bank/bank-site.css";
import "./registrars.css";
import { usePageAct } from "../../pageAct";

type Field = keyof Address;
const FIELDS: Field[] = ["contact", "company", "street", "zip", "city", "email"];
const EMPTY: Address = { contact: "", company: "", street: "", zip: "", city: "", email: "" };

// The orders whose domain waits for this form: new domains on the register page, owned ones on the transfer page. The
// order the page was opened for stays listed once its domain is done.
function domainChoices(game: GameState, transfer: boolean, keep: string) {
  return orderChoices(game, ["webHosting"]).filter((o) => {
    const q = game.sales.requests.find((x) => x.id === o.requestId)!;
    return (o.next === "domain" || o.ticketId === keep) && !!q.owned === transfer && !shopRegisters(game, q);
  }).map((o) => ({ ...o, error: stepError(game, game.tickets.find((x) => x.id === o.ticketId)!, "domain") }));
}

// The partner's registration or transfer form. A click on a line of the customer record beside it fills the focused owner
// field, the postcode line fills postcode and city, and the focus moves on to the next empty field, as in New customer in Books.
export function RegistrarForm({ game, r, transfer, ticketId }: { game: GameState; r: Registrar; transfer: boolean; ticketId: string }) {
  const act = usePageAct(), choices = domainChoices(game, transfer, ticketId);
  const [ticket, setTicket] = useState(choices.some((o) => o.ticketId === ticketId) ? ticketId : choices.length === 1 ? choices[0].ticketId : "");
  const [form, setForm] = useState<Address>(EMPTY), [focus, setFocus] = useState<Field>("contact");
  const [ns, setNs] = useState(() => [`ns1.${companyDomain(game)}`, `ns2.${companyDomain(game)}`]);
  const [auth, setAuth] = useState(""), [sent, setSent] = useState(false);
  const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});
  const o = choices.find((x) => x.ticketId === ticket), q = o && game.sales.requests.find((x) => x.id === o.requestId);
  const tk = game.tickets.find((x) => x.id === ticket), c = q && game.customers.find((x) => x.id === q.customerId);
  const rec = c?.address, postcode = rec ? `${rec.zip} ${rec.city}` : null;
  useEffect(() => refs.current[focus]?.focus(), [focus]);
  const fill = (line: string) => {
    const next = line === postcode && (focus === "zip" || focus === "city") ? { ...form, zip: rec!.zip, city: rec!.city } : { ...form, [focus]: line };
    setForm(next);
    const i = FIELDS.indexOf(focus), empty = [...FIELDS.slice(i + 1), ...FIELDS.slice(0, i)].find((k) => !next[k] && (k !== "company" || rec!.company));
    if (empty) setFocus(empty);
  };
  const title = transfer ? t("support.transferDomain") : t("support.registerDomain");
  const skin = { "--bar": `oklch(0.42 0.1 ${REGISTRAR_HUE[r.id]})`, "--accent": `oklch(0.55 0.09 ${REGISTRAR_HUE[r.id]})`, "--bg": "#f2f2ee" } as CSSProperties;
  return (
    <div className="bks" style={skin}>
      <header className="bks-head">
        <span className="bks-logo" aria-hidden>{r.name.charAt(0)}</span>
        <span className="bks-name">{r.name}</span>
      </header>
      <main className="bks-main rgf-split">
        <section className="bks-box">
          <h2>{title}</h2>
          <form className="bks-form" onSubmit={(e) => { e.preventDefault(); if (o && act(registerOrderDomain, o.ticketId, form, transfer ? auth : undefined).ok) setSent(true); }}>
            <OrderPicker choices={choices} value={ticket} onChange={(id) => { setTicket(id); setForm(EMPTY); setFocus("contact"); setAuth(""); setSent(false); }} className="" />
            <label>{t("browser-sites-1.rg.domain")}<input readOnly value={q?.domain ?? ""} /></label>
            {FIELDS.map((k) => (
              <label key={k}>{t(`orderSteps.field.${k}`)}
                <input ref={(el) => { refs.current[k] = el; }} value={form[k] ?? ""} onFocus={() => setFocus(k)} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
            {ns.map((v, i) => <label key={i}>{t("registrarForm.ns", { n: i + 1 })}<input spellCheck={false} value={v} onChange={(e) => setNs(ns.map((x, j) => (j === i ? e.target.value : x)))} /></label>)}
            {transfer && <label>{t("registrarForm.authCode")}<input spellCheck={false} autoCapitalize="characters" value={auth} onChange={(e) => setAuth(e.target.value)} /></label>}
            {sent ? <p className="bks-ok">{t("registrarForm.submitted")}</p>
              : <button className="bks-btn primary" type="submit" disabled={!o || !!o.error || !!tk?.work}>{title}</button>}
          </form>
        </section>
        {c && rec && (
          <section className="bks-box rgf-rec" aria-label={t("registrarForm.customer")}>
            <h2>{t("registrarForm.customer")}</h2>
            <address>{addressLines(rec).map((l) => <button key={l} type="button" className="rgf-l" onMouseDown={(e) => e.preventDefault()} onClick={() => fill(l)}>{l}</button>)}</address>
          </section>
        )}
      </main>
      <footer className="bks-foot">{t("bank.site.footer", { name: r.name, year: yearOf(game.hour) })}</footer>
    </div>
  );
}
