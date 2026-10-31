import { useState } from "react";
import { t } from "../../../i18n/en";
import { orderChoices, stepError } from "../../../sim/30-market/manual";
import type { GameState } from "../../../sim/50-state";
import { createAccount } from "../../../sim/90-actions/orders";
import { useStore } from "../../store";
import { OrderPicker } from "../browser/consoles/PackageForms";

// The accepted orders that wait for their customer account, ready for a form to take.
export function accountChoices(game: GameState) {
  const products = [...new Set(game.sales.requests.map((r) => r.product))];
  return orderChoices(game, products).filter((o) => o.next === "account").map((o) => ({ ...o, error: stepError(game, game.tickets.find((x) => x.id === o.ticketId)!, "account") }));
}

// Customers > New customer, drawn like the client form of a billing system. The order fills Name and Company.
export function NewCustomer({ game, initial, onDone }: { game: GameState; initial?: string | null; onDone: () => void }) {
  const act = useStore((s) => s.act), choices = accountChoices(game);
  const [ticket, setTicket] = useState(choices.some((o) => o.ticketId === initial) ? initial! : "");
  const o = choices.find((x) => x.ticketId === ticket), r = o && game.sales.requests.find((x) => x.id === o.requestId);
  const tk = game.tickets.find((x) => x.id === ticket);
  return (
    <form className="cus-new" onSubmit={(e) => { e.preventDefault(); if (o && act(createAccount, o.ticketId).ok) onDone(); }}>
      <fieldset>
        <legend>{t("pkg.personal")}</legend>
        <label className="field">{t("pkg.fullName")}<input value={r?.contact ?? ""} readOnly /></label>
        <label className="field">{t("pkg.company")}<input value={r?.company ?? ""} readOnly /></label>
      </fieldset>
      <fieldset>
        <legend>{t("pkg.order")}</legend>
        <OrderPicker choices={choices} value={ticket} onChange={setTicket} label="" className="field" />
      </fieldset>
      <div className="actions-row">
        <button className="btn primary" type="submit" disabled={!o || !!o.error || !!tk?.work}>{t("pkg.addClient")}</button>
        <button className="btn" type="button" onClick={onDone}>{t("pkg.cancel")}</button>
      </div>
    </form>
  );
}
