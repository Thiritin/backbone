import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { day, period } from "../tax";

type Params = Record<string, string | number>;
const pay = (p: Params) => `Transfiera ${euroCents(Number(p.amount))} antes del ${day(p.due)} a ${p.iban ? `IBAN ${p.iban}` : `la cuenta ${p.account}, código bancario ${p.code}`}, indicando la referencia ${p.number}.`;
const PERIOD: Record<string, string> = {"month": "presenta una declaración previa de IVA cada mes, antes del día 10 del mes siguiente", "quarter": "presenta una declaración previa de IVA cada trimestre, antes del día 10 del mes siguiente al trimestre", "year": "no presenta declaraciones previas de IVA y liquida el IVA en la declaración anual", "none": "no cobra IVA ni presenta declaraciones previas de IVA"};
const TAXNAME: Record<string, string> = {"sole": "impuesto sobre la renta", "partnership": "impuesto sobre la renta", "limited": "impuesto de sociedades"};

export default {
  "letter.taxQuestionnaire.subject": () => "Cuestionario de alta fiscal",
  "letter.taxQuestionnaire.body": (p) => `La oficina de comercio nos ha comunicado que ${p.name} ha iniciado una actividad. Rellene el cuestionario de alta fiscal en DOHLE, en www.dohle.de/erfassung/. Una empresa cuya facturación no supere ${euro(Number(p.limit))} al año puede acogerse al régimen de pequeña empresa y no cobrar IVA.`,
  "letter.taxNumber.subject": (p) => `Su número fiscal ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} está registrada con el número fiscal ${p.number}. Indíquelo en cada declaración y carta. ${p.period === "none" ? "Como pequeña empresa no cobra IVA ni presenta declaraciones previas de IVA." : "Presente la declaración previa de IVA de cada mes antes del día 10 del mes siguiente."}`,
  "sim.index.dohle": () => "Presentar declaraciones de impuestos en línea.",
  "error.taxNoQuestionnaire": () => "El cuestionario de Hacienda aún no ha llegado.",
  "error.taxAnswered": () => "El cuestionario ya se ha enviado.",
  "error.taxRevenue": () => "Introduzca la facturación prevista.",
  "error.taxSmallLimit": () => "La facturación prevista supera el límite del régimen de pequeña empresa.",
  "letter.taxSurcharge.subject": () => "Recargo por presentación tardía",
  "letter.taxSurcharge.body": (p) => `Número fiscal ${p.taxNo}. La declaración previa de IVA de ${period(p)} vencía el ${day(p.deadline)} y no la hemos recibido. Fijamos un recargo por presentación tardía de ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.vatEstimate.subject": (p) => `Estimación del IVA de ${period(p)}`,
  "letter.vatEstimate.body": (p) => `Número fiscal ${p.taxNo}. La declaración previa de IVA de ${period(p)} sigue sin presentarse, por lo que hemos estimado el IVA en ${euroCents(Number(p.amount))}. Presentar la declaración sustituye esta estimación. ${pay(p)}`,
  "letter.taxSmallEnd.subject": () => "Fin del régimen de pequeña empresa",
  "letter.taxSmallEnd.body": (p) => `La facturación de ${p.name} el año pasado fue de ${euro(Number(p.revenue))}, por encima del límite de ${euro(Number(p.limit))}. Desde el 1 de enero de ${p.year} la empresa cobra IVA y presenta declaraciones previas de IVA.`,
  "letter.taxPeriod.subject": (p) => `Periodo de IVA ${p.year}`,
  "letter.taxPeriod.body": (p) => `Desde el 1 de enero de ${p.year}, ${p.name} ${PERIOD[p.period] ?? p.period}.`,
  "ledger.vatReturn": (p) => `Declaración previa de IVA ${period(p)}`,
  "ledger.vatEstimate": (p) => `Estimación de IVA ${period(p)}`,
  "ledger.taxSurcharge": (p) => `Recargo por presentación tardía ${period(p)}`,
  "error.taxNumber": () => "La empresa aún no tiene número fiscal.",
  "error.taxReturn": () => "Esta declaración no existe.",
  "error.taxNotSmall": () => "La empresa no está acogida al régimen de pequeña empresa.",
  "error.taxReturnFiled": () => "Esta declaración ya se ha presentado.",
  "ticket.mail.dohleId.subject": () => "Su registro en DOHLE",
  "ticket.mail.dohleId.text": (p) => `Gracias por registrarse con el número fiscal ${p.number}. Su ID de activación es ${p.id}. El código de activación llega por correo postal. Introduzca ambos en www.dohle.de/registrieren/ para recibir su archivo de certificado.`,
  "letter.dohleCode.subject": () => "Su código de activación de DOHLE",
  "letter.dohleCode.body": (p) => `Para su registro con el número fiscal ${p.number} el código de activación es ${p.code}. Introdúzcalo junto con el ID de activación de nuestro correo en www.dohle.de/registrieren/.`,
  "error.dohleCert": () => "No se encontró el archivo de certificado de DOHLE en el escritorio.",
  "error.dohleTaxNumber": () => "El número fiscal no coincide.",
  "error.dohleMail": () => "Introduzca la dirección de correo de la empresa.",
  "error.dohleNoCode": () => "El código de activación aún no ha llegado.",
  "error.dohleCode": () => "El ID o el código de activación es incorrecto.",
  "letter.taxReminder.subject": (p) => `Declaración de impuestos ${p.year}`,
  "letter.taxReminder.body": (p) => `Número fiscal ${p.taxNo}. Le recordamos que la declaración de ${p.name} de ${p.year} vence el ${day(p.deadline)}. Preséntela en DOHLE.`,
  "letter.taxEstimate.subject": (p) => `Liquidación estimada ${p.year}`,
  "letter.taxEstimate.body": (p) => `Número fiscal ${p.taxNo}. La declaración de ${p.name} de ${p.year} no se ha presentado, por lo que hemos estimado el impuesto en ${euroCents(Number(p.amount))}. Presentarla antes de que acabe el año próximo sustituye esta estimación. ${pay(p)}`,
  "letter.taxAssessment.subject": (p) => `Liquidación ${p.year}`,
  "letter.taxAssessment.body": (p) => `Número fiscal ${p.taxNo}. Liquidamos el ${TAXNAME[p.form] ?? TAXNAME.sole} de ${p.name} de ${p.year}, con un beneficio imponible de ${euroCents(Number(p.profit))}, en ${euroCents(Number(p.tax))}.${Number(p.carry) > 0 ? ` Una pérdida de ${euroCents(Number(p.carry))} se compensa en el año siguiente.` : ""}${Number(p.fee) > 0 ? ` El recargo por presentación tardía de ${p.months} meses es de ${euroCents(Number(p.fee))}.` : ""}${Number(p.credit) > 0 ? ` Ya pagado por nuestra estimación: ${euroCents(Number(p.credit))}.` : ""} ${p.refund === undefined ? pay(p) : Number(p.refund) > 0 ? `Le devolvemos ${euroCents(Number(p.refund))} en su cuenta.` : "No hay nada que pagar."}`,
  "ledger.vatYear": (p) => `Declaración anual de IVA ${p.year}`,
  "ledger.taxLate": (p) => `Recargo por presentación tardía ${p.year}`,
  "ledger.taxCredit": (p) => `Abono de la estimación ${p.year}`,
  "ledger.taxEstimate": (p) => `Impuesto estimado ${p.year}`,
  "error.taxYearClosed": () => "La estimación de este año es firme.",
  "error.booksTaxView": () => "Para DOHLE hace falta el módulo Facturación mensual.",
  "error.booksNotLinked": () => "DOHLE no está conectado en la contabilidad.",
  "error.booksInvoices": () => "Faltan facturas de este año en la contabilidad.",
  "error.booksUnmatched": () => "El extracto de este año tiene transferencias sin asignar.",
} satisfies Dict;
