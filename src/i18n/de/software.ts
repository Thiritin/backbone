import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE, type Dict } from "../lang";

const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

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
  "software.support.updatesEnded": () => "Updates beendet",
  "software.support.securityEnded": () => "Sicherheitsupdates beendet",
  "ticket.mail.securityEnding.subject": (p) => `${p.software} ${p.version}: Ende der Sicherheitsupdates`,
  "ticket.mail.securityEnding.text": (p) => `Die Sicherheitsupdates für ${p.software} ${p.version} enden am ${day(p.until)}. Danach veröffentlichen wir keine Korrekturen für Sicherheitslücken in dieser Version mehr.`,
} satisfies Dict;
