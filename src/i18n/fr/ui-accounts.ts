import { euroCents } from "../../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "../lang";
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Électricité ${p.location} : ${kwh(p)} kWh à ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Électricité au compteur ${p.location} : ${kwh(p)} kWh à ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Facture ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `Veuillez trouver ci-joint notre facture ${p.number} de ${euroCents(Number(p.amount))}. Nous avons débité le montant sur votre carte de crédit.`,
  "error.payMethod": () => 'Choisissez virement, carte de crédit ou prélèvement.',
  "error.debitAbroad": () => 'Le prélèvement est réservé aux fournisseurs allemands.',
  "error.payNoCard": () => "Le compte n'a pas de carte de crédit.",
} satisfies Dict;
