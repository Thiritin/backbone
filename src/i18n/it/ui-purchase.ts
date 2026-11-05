import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "purchase.method.cash": () => "Contanti",
  "purchase.method.transfer": () => "Bonifico",
  "purchase.method.onAccount": () => "Su fattura",
  "purchase.method.card": () => "Carta",
  "purchase.method.debit": () => "Addebito diretto",
  "ticket.mail.receipt.subject": (p) => `Ricevuta ${p.number}`,
  "ticket.mail.receipt.text": (p) => `In allegato la nostra ricevuta ${p.number} di ${euroCents(Number(p.amount))}. Grazie per il pagamento in contanti.`,
  "ticket.mail.credit.subject": (p) => `Nota di credito ${p.number}`,
  "ticket.mail.credit.text": (p) => `In allegato la nostra nota di credito ${p.number} di ${euroCents(Number(p.amount))}. Abbiamo accreditato l'importo sul suo conto.`,
  "ticket.mail.contract.subject": (p) => `Conferma d'ordine ${p.number}`,
  "ticket.mail.contract.text": (p) => `In allegato la conferma del suo ordine ${p.number}.`,
} satisfies Dict;
