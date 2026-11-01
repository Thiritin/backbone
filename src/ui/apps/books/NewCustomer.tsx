import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../../../i18n/en";
import { addressLines, mailedAddress, type Address } from "../../../sim/30-customers/addresses";
import { orderChoices, stepError } from "../../../sim/30-market/manual";
import type { GameState } from "../../../sim/50-state";
import { createAccount } from "../../../sim/90-actions/orders";
import { useStore } from "../../store";
import { OrderPicker } from "../browser/consoles/PackageForms";

// The accepted orders that wait for their customer account.
export function accountChoices(game: GameState) {
  const products = [...new Set(game.sales.requests.map((r) => r.product))];
  return orderChoices(game, products).filter((o) => o.next === "account").map((o) => ({ ...o, error: stepError(game, game.tickets.find((x) => x.id === o.ticketId)!, "account") }));
}

// A customers focus that opens New customer, followed by the order ticket.
export const NEW = "new:";

type Field = keyof Address;
const FIELDS: Field[] = ["contact", "company", "street", "zip", "city", "email"];
const EMPTY: Address = { contact: "", company: "", street: "", zip: "", city: "", email: "" };

// Books > New customer: the order email pinned beside the form. A click on an email line fills the focused field, the
// postcode line fills postcode and city, and the focus moves on to the next empty field.
export function NewCustomer({ game, initial, onDone }: { game: GameState; initial?: string | null; onDone: () => void }) {
  const act = useStore((s) => s.act), choices = accountChoices(game);
  const [ticket, setTicket] = useState(choices.some((o) => o.ticketId === initial) ? initial! : choices.length === 1 ? choices[0].ticketId : "");
  const [form, setForm] = useState<Address>(EMPTY), [focus, setFocus] = useState<Field>("contact");
  const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});
  const o = choices.find((x) => x.ticketId === ticket), r = o && game.sales.requests.find((x) => x.id === o.requestId);
  const tk = game.tickets.find((x) => x.id === ticket);
  const mail = r ? mailedAddress(game.seed, r) : null, postcode = mail ? `${mail.zip} ${mail.city}` : null;
  useEffect(() => refs.current[focus]?.focus(), [focus]);
  const fill = (line: string) => {
    const next = line === postcode && (focus === "zip" || focus === "city") ? { ...form, zip: mail!.zip, city: mail!.city } : { ...form, [focus]: line };
    setForm(next);
    const i = FIELDS.indexOf(focus), empty = [...FIELDS.slice(i + 1), ...FIELDS.slice(0, i)].find((k) => !next[k] && (k !== "company" || mail!.company));
    if (empty) setFocus(empty);
  };
  return (
    <form className="books-new" onSubmit={(e) => { e.preventDefault(); if (o && act(createAccount, o.ticketId, form).ok) onDone(); }}>
      <div className="books-new-head">
        <h2>{t("pkg.newCustomer")}</h2>
        <OrderPicker choices={choices} value={ticket} onChange={(id) => { setTicket(id); setForm(EMPTY); setFocus("contact"); }} className="books-pick" />
      </div>
      <div className="books-new-split">
        <section className="books-mail" aria-label={t("orderSteps.orderEmail")}>
          {r && mail && (
            <>
              <div className="books-mail-hdr">{t("orderSteps.from", { name: r.contact })}</div>
              <p>{t(r.thread[0].key, r.thread[0].params)}</p>
              <address>{addressLines(mail).map((l) => <button key={l} type="button" className="books-mail-l" onMouseDown={(e) => e.preventDefault()} onClick={() => fill(l)}>{l}</button>)}</address>
            </>
          )}
        </section>
        <fieldset className="books-new-form">
          {FIELDS.map((k) => (
            <label key={k} className="books-f">{t(`orderSteps.field.${k}`)}
              <input ref={(el) => { refs.current[k] = el; }} value={form[k] ?? ""} className={`field${form[k] || k === "company" ? "" : " need"}`} onFocus={() => setFocus(k)}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <div className="actions-row">
            <button className="btn primary" type="submit" disabled={!o || !!o.error || !!tk?.work}><Save />{t("orderSteps.saveCustomer")}</button>
            <button className="btn" type="button" onClick={onDone}>{t("pkg.cancel")}</button>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
