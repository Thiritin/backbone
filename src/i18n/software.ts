import { euroCents } from "../sim/00-core/money";
type Params = Record<string, string | number>;

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
  "ledger.licenseOnce": (p) => `${p.name} license, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
};
