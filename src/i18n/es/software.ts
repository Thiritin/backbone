import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE, type Dict } from "../lang";

const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export default {
  "error.portTaken": () => "El software de esta máquina ya usa uno de sus puertos.",
  "error.wrongOs": () => "Este software no se ejecuta en el sistema operativo de esta máquina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "máquina" : "máquinas"}`,
  "ledger.licenceRenewal": (p) => `Suscripción de ${p.name}, clave ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `Suscripción de ${p.name} renovada`,
  "ticket.mail.licenceRenewed.text": (p) => `Su suscripción de ${p.name} se ha renovado por un mes más. ${p.count === 1 ? "1 clave" : `${p.count} claves`}, ${euroCents(Number(p.amount))} cobrados.`,
  "ticket.mail.licenceLapsed.subject": (p) => `Suscripción de ${p.name} caducada`,
  "ticket.mail.licenceLapsed.text": (p) => `No pudimos cobrar la renovación de su clave de ${p.name} ${p.key}. La licencia ha caducado y se renovará en cuanto se realice el pago.`,
  "ledger.licenseOnce": (p) => `Licencia de ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
  "software.support.updatesEnded": () => "Actualizaciones finalizadas",
  "software.support.securityEnded": () => "Actualizaciones de seguridad finalizadas",
  "ticket.mail.securityEnding.subject": (p) => `${p.software} ${p.version}: fin de las actualizaciones de seguridad`,
  "ticket.mail.securityEnding.text": (p) => `Las actualizaciones de seguridad de ${p.software} ${p.version} terminan el ${day(p.until)}. A partir de esa fecha dejamos de publicar correcciones de vulnerabilidades para esta versión.`,
} satisfies Dict;
