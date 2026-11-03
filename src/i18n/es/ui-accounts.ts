import { euroCents } from "../../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "../lang";
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Electricidad ${p.location}: ${kwh(p)} kWh a ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Electricidad por consumo ${p.location}: ${kwh(p)} kWh a ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Factura ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `Adjuntamos nuestra factura ${p.number} por ${euroCents(Number(p.amount))}. Hemos cargado el importe en su tarjeta de crédito.`,
  "error.payMethod": () => 'Elija transferencia, tarjeta de crédito o domiciliación.',
  "error.debitAbroad": () => 'La domiciliación solo está disponible con proveedores alemanes.',
  "error.payNoCard": () => 'La cuenta no tiene tarjeta de crédito.',
} satisfies Dict;
