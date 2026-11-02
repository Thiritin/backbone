import { euroCents } from "../sim/00-core/money";
import { dateOf } from "../sim/00-core/time";
import { LOCALE } from "./lang";

type Params = Record<string, string | number>;
const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

// Operating systems and software on machines (docs/design/software.md).
export const SOFTWARE_EN: Record<string, (p: Params) => string> = {
  "error.portTaken": () => "Software on this machine already uses one of its ports.",
  "error.wrongOs": () => "This software does not run on this machine's operating system.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "machine" : "machines"}`,
  "ledger.licenceRenewal": (p) => `${p.name} subscription, key ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `${p.name} subscription renewed`,
  "ticket.mail.licenceRenewed.text": (p) => `Your ${p.name} subscription renewed for another month. ${p.count === 1 ? "1 key" : `${p.count} keys`}, ${euroCents(Number(p.amount))} charged.`,
  "ticket.mail.licenceLapsed.subject": (p) => `${p.name} subscription lapsed`,
  "ticket.mail.licenceLapsed.text": (p) => `We could not charge the renewal of your ${p.name} key ${p.key}. The licence has lapsed and will be renewed as soon as the payment goes through.`,
  "ticket.mail.licenceEditionChange.subject": (p) => `${p.name} licence change`,
  "ticket.mail.licenceEditionChange.text": (p) => `We no longer sell the ${p.from} edition. At its next renewal, your ${p.name} key ${p.key} renews as ${p.to} at ${euroCents(Number(p.amount))} a month.`,
  "ticket.mail.licenceEditionSwitched.subject": (p) => `${p.name} licence changed`,
  "ticket.mail.licenceEditionSwitched.text": (p) => `Your ${p.name} key ${p.key} now has the ${p.to} edition.`,
  "ledger.licenseOnce": (p) => `${p.name} license, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
  "software.support.updatesEnded": () => "Updates ended",
  "software.support.securityEnded": () => "Security updates ended",
  "ticket.mail.securityEnding.subject": (p) => `${p.software} ${p.version}: end of security updates`,
  "ticket.mail.securityEnding.text": (p) => `Security updates for ${p.software} ${p.version} end on ${day(p.until)}. After that date we no longer publish fixes for vulnerabilities in this version.`,
};
