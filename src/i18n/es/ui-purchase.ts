import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "purchase.method.cash": () => "Efectivo",
  "purchase.method.transfer": () => "Transferencia",
  "purchase.method.onAccount": () => "A cuenta",
  "purchase.method.card": () => "Tarjeta",
  "purchase.method.debit": () => "Domiciliación",
  "ticket.mail.receipt.subject": (p) => `Recibo ${p.number}`,
  "ticket.mail.receipt.text": (p) => `Adjuntamos nuestro recibo ${p.number} por ${euroCents(Number(p.amount))}. Gracias por su pago en efectivo.`,
  "ticket.mail.credit.subject": (p) => `Abono ${p.number}`,
  "ticket.mail.credit.text": (p) => `Adjuntamos nuestro abono ${p.number} por ${euroCents(Number(p.amount))}. Hemos abonado el importe en su cuenta.`,
  "ticket.mail.contract.subject": (p) => `Confirmación de pedido ${p.number}`,
  "ticket.mail.contract.text": (p) => `Adjuntamos la confirmación de su pedido ${p.number}.`,
} satisfies Dict;
