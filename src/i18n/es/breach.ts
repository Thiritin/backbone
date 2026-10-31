import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.breach.title": () => "Datos de clientes robados",
  "event.breach.text": (p) => `Unos atacantes copiaron los datos de clientes de ${p.host} y exigen ${euro(Number(p.ransom))} en ${p.hours} horas.`,
  "event.breachPress.title": () => "Brecha de seguridad en la prensa",
  "event.breachPress.text": (p) => `Webs tecnológicas informan de que datos de clientes de ${p.host} están a la venta en línea. ${Number(p.customers) === 1 ? "Un cliente resultó afectado" : `${p.customers} clientes resultaron afectados`}.`,
  "event.breachFine.title": () => "Multa de protección de datos",
  "event.breachFine.text": (p) => `La autoridad de protección de datos multó a la empresa con ${euro(Number(p.amount))} por la brecha en ${p.host}.`,
  "ticket.extortion.data.subject": () => "Los datos de tus clientes están a la venta",
  "ticket.extortion.data.text": (p) =>
    `Tenemos los datos de clientes de ${p.host} y los hemos puesto a la venta en línea. Envía ${euro(Number(p.ransom))} en 72 horas y retiramos el anuncio. Después, el mejor postor se lleva todo.`,
  "ledger.ransom": (p) => `Rescate por ${p.host}`,
  "ledger.fine": (p) => `Multa de protección de datos por ${p.host}`,
  "outcome.ransomPaid": () => "Rescate pagado",
  "outcome.ransomRefused": () => "Rescate rechazado",
} satisfies Dict;
