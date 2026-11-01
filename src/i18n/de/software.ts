import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "Software auf dieser Maschine belegt bereits einen ihrer Ports.",
  "error.wrongOs": () => "Diese Software läuft nicht auf dem Betriebssystem dieser Maschine.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "Maschine" : "Maschinen"}`,
  "ledger.licenceRenewal": (p) => `${p.name}-Abo, Schlüssel ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `${p.name}-Abo verlängert`,
  "ticket.mail.licenceRenewed.text": (p) => `Ihr ${p.name}-Abo wurde um einen Monat verlängert. ${p.count === 1 ? "1 Schlüssel" : `${p.count} Schlüssel`}, ${euroCents(Number(p.amount))} abgebucht.`,
  "ticket.mail.licenceLapsed.subject": (p) => `${p.name}-Abo abgelaufen`,
  "ticket.mail.licenceLapsed.text": (p) => `Wir konnten die Verlängerung Ihres ${p.name}-Schlüssels ${p.key} nicht abbuchen. Die Lizenz ist abgelaufen und wird verlängert, sobald die Zahlung eingeht.`,
  "ledger.licenseOnce": (p) => `${p.name}-Lizenz, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
