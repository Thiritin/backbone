import { euroCents } from "../sim/00-core/money";
import { t } from "./en";

type Params = Record<string, string | number>;

const gb = (x: string | number) => `${x} GB`;
const mailboxes = (n: string | number) => `${n} mailbox${Number(n) === 1 ? "" : "es"}`;
const web = (p: Params) => `${gb(p.disk)} of space, ${gb(p.traffic)} of traffic a month and ${mailboxes(p.mail)}`;
const box = (p: Params) => `${p.cpu} vCPU${Number(p.cpu) === 1 ? "" : "s"}, ${gb(p.ram)} of RAM and ${gb(p.disk)} of disk`;
const cards = (p: Params) => `${p.gpu} GPU${Number(p.gpu) === 1 ? "" : "s"}`;
const domain = (p: Params) => (Number(p.owned) ? `I already own ${p.domain} and would like to move it to you.${p.auth ? ` The auth code is ${p.auth}.` : ""}` : `Please register ${p.domain} for me as well.`);
const more = (p: Params) => (p.product === "webHosting"
  ? `${gb(p.disk0)} to ${gb(p.disk1)} of space, ${gb(p.traffic0)} to ${gb(p.traffic1)} of traffic and ${p.mail0} to ${mailboxes(p.mail1)}`
  : and([
    Number(p.cpu1) > 0 && `${p.cpu0} to ${p.cpu1} vCPUs`, Number(p.ram1) > 0 && `${gb(p.ram0)} to ${gb(p.ram1)} of RAM`, Number(p.disk1) > 0 && `${gb(p.disk0)} to ${gb(p.disk1)} of disk`,
  ].filter((x): x is string => !!x)));
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] ?? "more room");

// Custom orders, domains and upgrades of custom services; spread into en.
export const MANUAL_EN: Record<string, (p: Params) => string> = {
  "order.msg.item": (p) => `I would like the ${p.item} package from your website.`,
  "order.msg.webHosting.0": (p) => `Hello, I need web hosting for ${p.domain}: about ${web(p)}. ${domain(p)}`,
  "order.msg.webHosting.1": (p) => `A friend recommended you. My website ${p.domain} needs ${web(p)}. ${domain(p)} What would that cost?`,
  "order.msg.vps.0": (p) => `I would like a VPS in ${p.city} with ${box(p)}. Root access, please. I know what I am doing.`,
  "order.msg.vps.1": (p) => `Please set up a virtual server for me: ${box(p)}. Debiant would be nice, and monthly billing.`,
  "order.msg.gameServer.0": (p) => `We need a game server for our clan with ${box(p)}. It has to be up by Friday night.`,
  "order.msg.gameServer.1": (p) => `Please set up a game server in ${p.city}: ${box(p)}. Low ping matters more to us than anything.`,
  "order.msg.gpu.0": (p) => `I would like a GPU server in ${p.city} with ${cards(p)}, ${box(p)}. I need it to train my models.`,
  "order.msg.gpu.1": (p) => `Please set up a virtual server with ${cards(p)} for me: ${box(p)}. CUDA drivers would be nice, and monthly billing.`,
  "sales.msg.upgrade": (p) => `We keep hitting our limits. We need ${more(p)}. What would upgrading cost us?`,
  "sales.you.upgrade": (p) => `We can do the upgrade for ${euroCents(Number(p.price))} a month in total.`,
  "sales.you.upgradeDone": (p) => `The upgrade is live. Your service runs with the new resources at ${euroCents(Number(p.price))} a month from now on.`,
  "ticket.upgrade.more.subject": (p) => `${p.hostname || p.service || "My service"} is getting too small`,
  "ticket.upgrade.more.text": () => "We keep running out of room. What would upgrading cost us?",
  "invoice.line.firstMonth": (p) => `${p.label}, first month`,
  "invoice.line.setupFee": (p) => `${p.label}, setup fee`,
  "invoice.line.domain": (p) => `Domain ${p.domain}, first year`,
  "invoice.line.domainTransfer": (p) => `Transfer of ${p.domain}`,
  "invoice.line.domainRenewal": (p) => `Domain ${p.domain}, one more year`,
  "ledger.domain": (p) => `${p.domain} at ${p.registry}`,
  "ledger.domainTransfer": (p) => `Transfer of ${p.domain} to ${p.registry}`,
  "ledger.domainRenewal": (p) => `Renewal of ${p.domain} at ${p.registry}`,
  "activity.renewDomain": (p) => `Renewed ${p.domain} for a year`,
  "activity.changePackage": (p) => `Moved to package ${p.pkg}`,
  "activity.upgrade": (p) => `Upgraded the service at ${euroCents(Number(p.price))} a month`,
  "event.orderAccepted.title": () => "Quote accepted",
  "event.orderAccepted.text": (p) => `${p.name} accepted the quote.`,
  "event.orderPaid.title": () => "Order paid",
  "event.orderPaid.text": (p) => `${p.name} paid the order invoice and waits for the setup.`,
  "event.stepFailed.title": () => "Order step failed",
  "event.stepFailed.text": (p) => `${p.name}: ${t(String(p.error))}`,
  "event.domainExpiring.title": () => "Domain expires soon",
  "event.domainExpiring.text": (p) => `${p.domain} expires in ${p.days} days.`,
  "event.domainExpired.title": () => "Domain expired",
  "event.domainExpired.text": (p) => `${p.domain} expired and its site is offline.`,
  "lost.unpaid": () => "Never paid",
  "error.needsQuote": () => "The customer has not accepted a quote yet.",
  "error.quoteSent": () => "The customer has not answered the quote yet.",
  "error.needsAutomation": () => "Choose a host to set it up on.",
  "error.needsAccount": () => "Create the customer account first.",
  "error.addressMissing": () => "Enter the full address.",
  "error.quoteSentAlready": () => "This quote was sent already.",
  "error.quoteOtherOrder": () => "This quote belongs to another order.",
  "error.quoteNotAccepted": () => "The customer has not accepted this quote.",
  "error.quoteInvoiced": () => "This quote was carried forward already.",
  "error.needsInvoice": () => "Confirm the order and send the invoice first.",
  "error.needsDomain": () => "Register the domain first.",
  "error.stepDone": () => "This step is done.",
  "error.domainTaken": () => "This domain belongs to another customer.",
  "error.unknownDomain": () => "This domain is not registered for an active customer.",
  "error.routeElsewhere": () => "This cluster is in another city.",
};
