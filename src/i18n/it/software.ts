import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "Un software su questa macchina usa già una delle sue porte.",
  "error.wrongOs": () => "Questo software non gira sul sistema operativo di questa macchina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "macchina" : "macchine"}`,
  "ledger.licenceRenewal": (p) => `Abbonamento ${p.name}, chiave ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `Abbonamento ${p.name} rinnovato`,
  "ticket.mail.licenceRenewed.text": (p) => `Il suo abbonamento ${p.name} è stato rinnovato per un altro mese. ${p.count === 1 ? "1 chiave" : `${p.count} chiavi`}, ${euroCents(Number(p.amount))} addebitati.`,
  "ticket.mail.licenceLapsed.subject": (p) => `Abbonamento ${p.name} scaduto`,
  "ticket.mail.licenceLapsed.text": (p) => `Non è stato possibile addebitare il rinnovo della sua chiave ${p.name} ${p.key}. La licenza è scaduta e verrà rinnovata appena il pagamento andrà a buon fine.`,
  "ledger.licenseOnce": (p) => `Licenza ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
