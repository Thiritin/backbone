import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "purchase.method.cash": () => "Barzahlung",
  "purchase.method.transfer": () => "Überweisung",
  "purchase.method.onAccount": () => "Kauf auf Rechnung",
  "purchase.method.card": () => "Karte",
  "purchase.method.debit": () => "Lastschrift",
  "ticket.mail.receipt.subject": (p) => `Quittung ${p.number}`,
  "ticket.mail.receipt.text": (p) => `Anbei erhalten Sie unsere Quittung ${p.number} über ${euroCents(Number(p.amount))}. Vielen Dank für Ihre Barzahlung.`,
  "ticket.mail.credit.subject": (p) => `Gutschrift ${p.number}`,
  "ticket.mail.credit.text": (p) => `Anbei erhalten Sie unsere Gutschrift ${p.number} über ${euroCents(Number(p.amount))}. Wir haben den Betrag Ihrem Konto gutgeschrieben.`,
  "ticket.mail.contract.subject": (p) => `Auftragsbestätigung ${p.number}`,
  "ticket.mail.contract.text": (p) => `Anbei erhalten Sie die Bestätigung Ihres Auftrags ${p.number}.`,
} satisfies Dict;
