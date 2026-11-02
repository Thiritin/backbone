import { useState, type FormEvent, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { groupIban, ibanEra, ownIban } from "../../../../../sim/46-finance/bank";
import type { GameState, PostalAddress } from "../../../../../sim/50-state";
import { salesAddress } from "../../../../../sim/80-business/mail";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { noAutofill } from "../../../../no-autofill";
import "./checkout.css";

export type AddressValue = PostalAddress & { company?: string };

// Street, postal code and city as table rows. autofill offers that address under the street field once it has focus.
export function AddressFields({ id, value, set, autofill, error }: {
  id: string; value: AddressValue; set: (v: AddressValue) => void; autofill?: AddressValue | null; error?: ReactNode;
}) {
  const [suggest, setSuggest] = useState(false);
  const field = (k: keyof PostalAddress, label: string, extra: ReactNode = null) => (
    <tr>
      <td><label htmlFor={`${id}-${k}`}>{label} <b>*</b></label></td>
      <td>
        <input id={`${id}-${k}`} value={value[k]} required {...noAutofill} onChange={(e) => set({ ...value, [k]: e.target.value })}
          {...(k === "street" && { onFocus: () => setSuggest(true), onBlur: () => setSuggest(false) })} />
        {extra}
      </td>
    </tr>
  );
  const chip = autofill && suggest && (
    // preventDefault keeps the focus, so the blur does not hide the chip before the click lands.
    <button type="button" className="co-autofill" onMouseDown={(e) => { e.preventDefault(); set({ ...value, ...autofill }); setSuggest(false); }}>
      {[autofill.company, autofill.street, `${autofill.zip} ${autofill.city}`].filter(Boolean).join(", ")}
    </button>
  );
  return (
    <>
      {field("street", t("checkout.street"), chip)}
      {field("zip", t("checkout.zip"))}
      {field("city", t("checkout.city"), error)}
    </>
  );
}

export type Payment =
  | { kind: "card"; number: string; expiry: string; cvc: string; holder: string }
  | { kind: "transfer" }
  | { kind: "debit"; iban: string; holder: string };
export type PaymentKind = Payment["kind"];
export interface CheckoutDetails { company: string; name: string; address: PostalAddress; email: string; payment: Payment }
export interface CheckoutLine { label: string; qty: number; price: string }
// What the confirmation shows for a placed order: the payee's bank details for a transfer still to make, and what comes next.
export interface Confirmation { bank: [string, string][] | null; next: string }

// The owner as the trade office has it ("Becker, Tin" or "Tin Becker") split into first and last name.
function splitName(owner: string): [string, string] {
  const [last, first] = owner.split(",").map((x) => x.trim());
  if (first !== undefined) return [first, last];
  const words = owner.trim().split(/\s+/);
  return words.length > 1 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : ["", owner.trim()];
}

const STEPS = ["checkout.billing", "checkout.payment", "checkout.review"];
// The step whose fields an error from the shop is about.
const STEP_OF: Record<string, number> = { "error.orderName": 0, "error.orderAddress": 0, "error.cardDeclined": 1, "error.noCard": 1, "error.cardLimit": 1 };

// A web shop's order form in three steps and its confirmation; the site puts it in its own page and passes its button class.
export function Checkout({ game, btn, lines, total, methods, place, confirm }: {
  game: GameState; btn: string; lines: CheckoutLine[]; total: string;
  methods: { kind: PaymentKind; label: string }[];
  place: (d: CheckoutDetails) => ActionResult;
  confirm: (order: string, kind: PaymentKind) => Confirmation;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ order: string; info: Confirmation } | null>(null);
  const [first0, last0] = splitName(game.registration?.owner ?? "");
  const [first, setFirst] = useState(first0), [last, setLast] = useState(last0);
  const [email, setEmail] = useState(salesAddress(game));
  const [address, setAddress] = useState<AddressValue>({ company: game.company.name, street: "", zip: "", city: "" });
  const [kind, setKind] = useState<PaymentKind>(methods[0].kind);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", holder: "" });
  const [debit, setDebit] = useState({ iban: game.bank ? (ibanEra(game) ? groupIban(ownIban(game)) : game.bank.number) : "", holder: game.company.name });
  const autofill = game.company.address && { company: game.company.name, ...game.company.address };

  if (placed) return (
    <div className="co">
      <h2>{t("checkout.thanks")}</h2>
      <p>{t("checkout.number", { order: placed.order })}</p>
      {placed.info.bank && <>
        <p>{t("checkout.transferTo")}</p>
        <table className="co-table"><tbody>{placed.info.bank.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}</tbody></table>
      </>}
      <p>{placed.info.next}</p>
    </div>
  );

  const payment: Payment = kind === "card" ? { kind, ...card } : kind === "debit" ? { kind, ...debit } : { kind };
  const details: CheckoutDetails = { company: address.company ?? "", name: `${first.trim()} ${last.trim()}`.trim(), address, email, payment };
  const go = (n: number) => (e: FormEvent) => { e.preventDefault(); setError(null); setStep(n); };
  const order = () => {
    const r = place(details);
    if (r.ok) return setPlaced({ order: r.id ?? "", info: confirm(r.id ?? "", kind) });
    setError(t(r.error, r.params));
    setStep(STEP_OF[r.error] ?? 2);
  };
  const input = (id: string, label: string, value: string, set: (v: string) => void, extra: Record<string, unknown> = {}) => (
    <tr>
      <td><label htmlFor={`co-${id}`}>{label} <b>*</b></label></td>
      <td><input id={`co-${id}`} value={value} required {...noAutofill} {...extra} onChange={(e) => set(e.target.value)} /></td>
    </tr>
  );
  const back = step > 0 && <button type="button" className={btn} onClick={() => { setError(null); setStep(step - 1); }}>{t("checkout.back")}</button>;
  const alert = error && <p className="co-error" role="alert">{error}</p>;
  const method = methods.find((m) => m.kind === kind)?.label ?? "";

  return (
    <div className="co">
      <ol className="co-steps">{STEPS.map((k, i) => <li key={k} className={i === step ? "on" : i < step ? "done" : ""}>{t(k)}</li>)}</ol>
      {step === 0 && (
        <form onSubmit={go(1)}>
          <table className="co-fields"><tbody>
            <tr>
              <td><label htmlFor="co-company">{t("checkout.company")}</label></td>
              <td><input id="co-company" value={address.company ?? ""} {...noAutofill} onChange={(e) => setAddress({ ...address, company: e.target.value })} /></td>
            </tr>
            {input("first", t("checkout.firstName"), first, setFirst)}
            {input("last", t("checkout.lastName"), last, setLast)}
            <AddressFields id="co" value={address} set={setAddress} autofill={autofill} />
            <tr><td>{t("checkout.country")}</td><td>{t("checkout.germany")}</td></tr>
            {input("email", t("checkout.email"), email, setEmail, { type: "email" })}
          </tbody></table>
          {alert}
          <p className="co-buttons"><button type="submit" className={btn}>{t("checkout.continue")}</button></p>
        </form>
      )}
      {step === 1 && (
        <form onSubmit={go(2)}>
          <fieldset className="co-methods">
            <legend>{t("checkout.paymentMethod")}</legend>
            {methods.map((m) => <label key={m.kind}><input type="radio" name="co-pay" checked={kind === m.kind} onChange={() => setKind(m.kind)} /> {m.label}</label>)}
          </fieldset>
          {kind === "card" && <table className="co-fields"><tbody>
            {input("number", t("checkout.cardNumber"), card.number, (number) => setCard({ ...card, number }), { inputMode: "numeric", maxLength: 23 })}
            {input("expiry", t("checkout.expiry"), card.expiry, (expiry) => setCard({ ...card, expiry }), { maxLength: 7, size: 7 })}
            {input("cvc", t("checkout.cvc"), card.cvc, (cvc) => setCard({ ...card, cvc }), { inputMode: "numeric", maxLength: 4, size: 4 })}
            {input("holder", t("checkout.holder"), card.holder, (holder) => setCard({ ...card, holder }))}
          </tbody></table>}
          {kind === "debit" && <table className="co-fields"><tbody>
            {input("iban", ibanEra(game) ? t("checkout.iban") : t("checkout.accountNumber"), debit.iban, (iban) => setDebit({ ...debit, iban }))}
            {input("debit-holder", t("checkout.accountHolder"), debit.holder, (holder) => setDebit({ ...debit, holder }))}
          </tbody></table>}
          {alert}
          <p className="co-buttons">{back}<button type="submit" className={btn}>{t("checkout.continue")}</button></p>
        </form>
      )}
      {step === 2 && <>
        <table className="co-table">
          <thead><tr><th>{t("checkout.item")}</th><th className="num">{t("checkout.qty")}</th><th className="num">{t("checkout.price")}</th></tr></thead>
          <tbody>{lines.map((l, i) => <tr key={i}><td>{l.label}</td><td className="num">{l.qty}</td><td className="num">{l.price}</td></tr>)}</tbody>
          <tfoot><tr><th>{t("checkout.total")}</th><td /><td className="num"><b>{total}</b></td></tr></tfoot>
        </table>
        <div className="co-summary">
          <section>
            <h3>{t("checkout.billingAddress")}</h3>
            <p>{[details.company, details.name, address.street, `${address.zip} ${address.city}`, t("checkout.germany"), email].filter((x) => x.trim()).map((x, i) => <span key={i}>{x}<br /></span>)}</p>
          </section>
          <section>
            <h3>{t("checkout.paymentMethod")}</h3>
            <p>{method}{kind === "card" && card.number && <><br />•••• {card.number.replace(/\D/g, "").slice(-4)}</>}</p>
          </section>
        </div>
        {alert}
        <p className="co-buttons">{back}<button type="button" className={btn} onClick={order}>{t("checkout.placeOrder")}</button></p>
      </>}
    </div>
  );
}
