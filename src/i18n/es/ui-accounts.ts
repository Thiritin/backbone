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
  "accounts.myAccount": () => 'Mi cuenta',
  "accounts.portal": () => 'Área de cliente',
  "accounts.payMethod": () => 'Forma de pago',
  "accounts.pay.transfer": () => 'Factura (transferencia)',
  "accounts.pay.card": () => 'Tarjeta de crédito',
  "accounts.pay.debit": () => 'Domiciliación SEPA',
  "accounts.germanyOnly": () => 'Solo Alemania',
  "accounts.invoices": () => 'Facturas',
  "accounts.issued": () => 'Fecha',
  "accounts.contract": () => 'Contrato',
  "accounts.customerNo": () => 'Número de cliente',
  "accounts.customer": () => 'Cliente',
  "accounts.address": () => 'Dirección de suministro',
  "accounts.points": () => 'Puntos de suministro',
  "accounts.point": () => 'Punto de suministro',
  "accounts.tariff": () => 'Tarifa',
  "accounts.price": () => 'Precio de la energía',
  "accounts.usage": () => 'Consumo',
  "accounts.period": () => 'Periodo',
  "accounts.thisMonth": () => 'Mes en curso',
  "accounts.noUsage": () => 'Sin consumo',
  "accounts.eoff.power": () => 'Electricidad',
  "accounts.eoff.hero": () => 'Electricidad para su empresa',
  "accounts.eoff.tariff": () => 'E.OFF Business Power',
} satisfies Dict;
