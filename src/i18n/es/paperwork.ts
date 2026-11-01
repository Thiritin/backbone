import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE } from "../lang";

type Params = Record<string, string | number>;
const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FORM: Record<string, string> = { sole: "empresario individual", partnership: "sociedad colectiva", limited: "sociedad limitada" };
const pay = (p: Params) => `Transfiera ${euroCents(Number(p.amount))} antes del ${day(p.due)} a ${p.iban ? `IBAN ${p.iban}` : `la cuenta ${p.account}, código bancario ${p.code}`}, indicando la referencia ${p.number}.`;

export default {
  "doc.form.partnership": () => "Modificación de registro GA-2.pdf",
  "doc.form.limited": () => "Estatutos sociales.pdf",
  "error.notRegistered": () => "La empresa aún no está registrada.",
  "error.legalFormDown": () => "La forma jurídica solo puede cambiarse por una superior.",
  "error.registerSole": () => "Un negocio solo puede registrarse como empresario individual.",
  "error.companyLaw": () => "Fundar una sociedad limitada requiere Derecho societario de Investigación.",
  "error.changePending": () => "Ya hay un cambio de forma jurídica en curso.",
  "error.formSigned": () => "Este formulario ya está firmado.",
  "error.mailAddress": () => "Introduce una dirección de correo válida.",
  "error.unknownLetter": () => "Esta carta ya no existe.",
  "ledger.tradeRegistration": () => "Tasa de alta de actividad",
  "ledger.tradeChange": () => "Tasa de modificación de actividad",
  "ledger.notary": () => "Honorarios notariales, estatutos",
  "ledger.registerEntry": () => "Tasa de inscripción en el registro mercantil",
  "ledger.chamber": (p) => `Cuota básica de la cámara de comercio ${p.year}`,
  "sim.index.cat.government": () => "Administración",
  "sim.index.office": () => "Registra una actividad o cambia su forma jurídica.",
  "browser-sites-1.ix.title": () => "Directorio Yahoy!",

  "letter.officeRegistered.subject": (p) => `Alta de actividad n.º GA ${p.reg}`,
  "letter.officeRegistered.body": (p) => `Confirmamos el registro de ${p.name} con el número GA ${p.reg}. ${pay(p)}`,
  "letter.officeChange.subject": () => "Modificación del registro de actividad",
  "letter.officeChange.body": (p) => `Confirmamos que ${p.name} está registrada como ${FORM[p.form] ?? p.form} desde hoy. ${pay(p)}`,
  "letter.notaryInvoice.subject": (p) => `Factura ${p.number}`,
  "letter.notaryInvoice.body": (p) => `Por elevar a escritura pública los estatutos de ${p.name} y presentarlos en el registro mercantil cobramos ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.registerEntry.subject": () => "Inscripción en el registro mercantil",
  "letter.registerEntry.body": (p) => `${p.name} ha quedado inscrita en el registro mercantil como ${FORM[p.form] ?? p.form}. La inscripción surte efecto hoy. Nuestra factura por la inscripción llegará por separado.`,
  "letter.registerInvoice.subject": (p) => `Factura ${p.number}`,
  "letter.registerInvoice.body": (p) => `Por la inscripción de ${p.name} en el registro mercantil cobramos ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.chamberFee.subject": (p) => `Cuota de socio ${p.year}`,
  "letter.chamberFee.body": (p) => `Como actividad registrada, ${p.name} es miembro de la cámara de comercio. Con ${p.staff} empleados, su cuota básica para ${p.year} es de ${euroCents(Number(p.amount))}. ${pay(p)}`,

  "ticket.mail.bounce.subject": () => "Correo no entregado devuelto al remitente",
  "ticket.mail.bounce.text": (p) => `Su mensaje a ${p.to} no se pudo entregar. La dirección no existe.`,
  "ticket.mail.noForm.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.noForm.text": () => "Gracias por su mensaje. No encontramos ninguna solicitud en el adjunto. Adjunte el formulario firmado.",
  "ticket.mail.wrongDesk.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.wrongDesk.text": () => "Gracias por su mensaje. Esta solicitud no nos corresponde. Envíela a la dirección indicada en el formulario.",
  "ticket.mail.unsigned.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.unsigned.text": () => "Gracias por su solicitud. El formulario no está firmado. Fírmelo y envíelo de nuevo.",
  "ticket.mail.capital.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.capital.text": (p) => `Gracias por los estatutos firmados. Una sociedad limitada necesita un capital social de ${euro(Number(p.amount))} en su cuenta antes de que podamos presentarla. Envíe los estatutos de nuevo cuando el capital esté disponible.`,
  "ticket.mail.notaryFiled.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.notaryFiled.text": (p) => `Gracias por los estatutos firmados de ${p.name}. Los presentaremos en el registro mercantil en un plazo de ${p.days} días hábiles. El registro confirmará la inscripción por carta.`,
  "ticket.mail.officeReceived.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.officeReceived.text": (p) => `Hemos recibido la modificación del registro de ${p.name}. Recibirá nuestra confirmación por carta en un plazo de ${p.days} días hábiles.`,
} satisfies Dict;
