import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE, type Dict } from "../lang";

const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export default {
  "error.portTaken": () => "Un software su questa macchina usa già una delle sue porte.",
  "error.wrongOs": () => "Questo software non gira sul sistema operativo di questa macchina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "macchina" : "macchine"}`,
  "ledger.licenceRenewal": (p) => `Abbonamento ${p.name}, chiave ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `Abbonamento ${p.name} rinnovato`,
  "ticket.mail.licenceRenewed.text": (p) => `Il suo abbonamento ${p.name} è stato rinnovato per un altro mese. ${p.count === 1 ? "1 chiave" : `${p.count} chiavi`}, ${euroCents(Number(p.amount))} addebitati.`,
  "ticket.mail.licenceLapsed.subject": (p) => `Abbonamento ${p.name} scaduto`,
  "ticket.mail.licenceLapsed.text": (p) => `Non è stato possibile addebitare il rinnovo della sua chiave ${p.name} ${p.key}. La licenza è scaduta e verrà rinnovata appena il pagamento andrà a buon fine.`,
  "ticket.mail.licenceEditionChange.subject": (p) => `Modifica della sua licenza ${p.name}`,
  "ticket.mail.licenceEditionChange.text": (p) => `Non vendiamo più l'edizione ${p.from}. Al prossimo rinnovo, la sua chiave ${p.name} ${p.key} verrà rinnovata come ${p.to} a ${euroCents(Number(p.amount))} al mese.`,
  "ticket.mail.licenceEditionSwitched.subject": (p) => `La sua licenza ${p.name} è cambiata`,
  "ticket.mail.licenceEditionSwitched.text": (p) => `La sua chiave ${p.name} ${p.key} ha ora l'edizione ${p.to}.`,
  "ledger.licenseOnce": (p) => `Licenza ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
  "software.support.updatesEnded": () => "Aggiornamenti terminati",
  "software.support.securityEnded": () => "Aggiornamenti di sicurezza terminati",
  "ticket.mail.securityEnding.subject": (p) => `${p.software} ${p.version}: fine degli aggiornamenti di sicurezza`,
  "ticket.mail.securityEnding.text": (p) => `Gli aggiornamenti di sicurezza per ${p.software} ${p.version} terminano il ${day(p.until)}. Dopo tale data non pubblichiamo più correzioni di vulnerabilità per questa versione.`,
} satisfies Dict;
