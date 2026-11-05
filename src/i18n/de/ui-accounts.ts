import { euroCents } from "../../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "../lang";
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Strom ${p.location}: ${kwh(p)} kWh zu ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Strom nach Verbrauch ${p.location}: ${kwh(p)} kWh zu ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Rechnung ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `Anbei erhalten Sie unsere Rechnung ${p.number} über ${euroCents(Number(p.amount))}. Wir haben den Betrag Ihrer Kreditkarte belastet.`,
  "error.payMethod": () => 'Wähle Überweisung, Kreditkarte oder Lastschrift.',
  "error.debitAbroad": () => 'Lastschrift ist nur bei deutschen Lieferanten möglich.',
  "error.payNoCard": () => 'Das Konto hat keine Kreditkarte.',
  "accounts.myAccount": () => 'Mein Konto',
  "accounts.portal": () => 'Kundenkonto',
  "accounts.payMethod": () => 'Zahlungsart',
  "accounts.pay.transfer": () => 'Rechnung (Überweisung)',
  "accounts.pay.card": () => 'Kreditkarte',
  "accounts.pay.debit": () => 'SEPA-Lastschrift',
  "accounts.germanyOnly": () => 'nur Deutschland',
  "accounts.invoices": () => 'Rechnungen',
  "accounts.issued": () => 'Datum',
  "accounts.contract": () => 'Vertrag',
  "accounts.customerNo": () => 'Kundennummer',
  "accounts.customer": () => 'Kunde',
  "accounts.address": () => 'Lieferadresse',
  "accounts.points": () => 'Verbrauchsstellen',
  "accounts.point": () => 'Verbrauchsstelle',
  "accounts.tariff": () => 'Tarif',
  "accounts.price": () => 'Arbeitspreis',
  "accounts.usage": () => 'Verbrauch',
  "accounts.period": () => 'Zeitraum',
  "accounts.thisMonth": () => 'Laufender Monat',
  "accounts.noUsage": () => 'Kein Verbrauch',
  "accounts.eoff.power": () => 'Strom',
  "accounts.eoff.hero": () => 'Strom für Ihr Unternehmen',
  "accounts.eoff.tariff": () => 'E.OFF Strom Business',
} satisfies Dict;
