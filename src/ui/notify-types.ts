import { t } from "../i18n/en";
// Notification types: groups of event keys inside an app that Settings can switch on and off one by one.
export interface NotifyType { id: string; label: string; match: (key: string) => boolean }

// Names are event keys without the "event." prefix; a trailing * matches every key that starts with the name.
const is = (...names: string[]) => (key: string) =>
  names.some((n) => (n.endsWith("*") ? key.startsWith(`event.${n.slice(0, -1)}`) : key === `event.${n}`));
const key = (label: string) => `core.notify.${label.replace(/[^A-Za-z]+/g, " ").trim().replace(/ (\w)/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase())}`;
const type = (label: string, ...names: string[]): NotifyType => ({ id: label.toLowerCase().replace(/[^a-z]+/g, "-"), label: t(key(label)), match: is(...names) });

const GROUPS: Record<string, NotifyType[]> = {
  Finance: [type("Bills and tax", "bills", "monthStart", "tax", "taxLoss", "networkBills"), type("Cash and loans", "cashNegative", "bankrupt", "loanMissed", "loanCalled")],
  Support: [
    type("Tickets", "ticket", "tickets", "stepFailed", "offerDeclined"),
    type("Migration offers", "moveAccepted", "moveDeclined", "moveWindow", "moveDone", "moveMissed"),
    type("Orders and sales", "order", "orderAccepted", "orderQuoted", "orderFailed", "orderDeclined", "orderPaid", "sales*"),
    type("Sponsoring requests", "sponsorRequest", "boardApplication"),
    type("Notices and legal", "seized", "breach"),
    type("Power", "gridDark", "gridCarried", "feedDark", "feedCarried", "feedCascade", "coolingFailed", "overheated"),
  ],
  Browser: [
    type("Domains", "registrarTier", "domainsTransferred"),
    type("Trade office", "officeOpen"),
    type("Site", "siteDown"),
  ],
  Locations: [
    type("Planned maintenance", "maintenanceStart", "maintenanceEnd"),
    type("Hardware failures", "componentFailed", "dataLoss", "dataCorrupted", "recovered", "serverHung", "serverStuck", "breakerTripped", "feedTripped", "bmcHung", "nodeFrozen", "nodeThawed"),
    type("Deliveries and moves", "rackArrived", "stockArrived", "drained", "spaceHeld", "holdExpired", "seizedBack"),
    type("Internet line", "lineReady", "lineFull"),
    type("Burn-in and refunds", "burninQuick", "burninFull", "burninAborted", "usedRefund"),
    type("Hand work", "workDone"),
    type("Workloads and migrations", "migrated", "migrationFailed", "failedOver", "failoverStuck"),
    type("Backups", "backupFailed"),
    type("Installs", "installed", "switched"),
    type("Uplinks and peering", "uplinkReady", "peeringRequest"),
    type("Attacks and saturation", "ddos", "saturated"),
    type("Addresses", "addressListed"),
  ],
  Security: [type("Advisories", "vuln.announced", "vuln.poc", "vuln.warning", "vuln.patch"), type("Compromises", "vuln.hacked", "oobHacked", "siteHacked", "siteLeft", "breachPress", "breachFine", "shopBreach"), type("Open vulnerabilities", "vulnOpen", "vulnCritical")],
  Marketing: [type("Reviews", "review"), type("Campaigns and bills", "fairDone", "fairMissed", "marketingBills", "platformDropped"), type("Community events", "sponsorDone", "sponsorFailed", "halfAccepted", "halfDeclined"), type("Sponsor board", "boardDropped", "boardDone"), type("Website", "siteBuilt")],
  Staff: [
    type("Hiring and leaving", "quit", "raise", "salaries"),
    type("Training", "trained", "trainerDone"),
    type("On call and tech", "onCallAbuse", "onCallBlackhole", "phpUpgraded", "techFailed", "techReplaced", "techInstalled", "techRemoved", "techUpdated", "botIncident*"),
  ],
  Customers: [type("Orders and sign-ups", "orderPlaced", "certificateSold", "friendsJoined")],
  Billing: [type("Payments and dunning", "collected", "invoices", "suspended", "suspendedLeft", "chargeback", "chargebackWarning", "chargebackFees"), type("Domains", "domainExpired", "domainExpiring")],
  Research: [type("Unlocks", "trainingDone")],
  Shop: [type("Used market", "used*")],
  News: [type("Hardware", "news.generation", "news.endOfSale", "news.gpu", "news.models", "news.shape", "news.vendor"), type("Software", "news.software", "news.autoUpdate", "news.feature", "news.desk", "news.training", "news.release"), type("Internet", "news.ipv6*", "news.ripe*", "news.homeLines", "news.ports"), type("Market", "news.design", "news.line", "news.mail", "news.gpuDemand", "news.used*", "news.freeSsl")],
};

const OTHER: NotifyType = { id: "other", label: t("core.notify.other"), match: () => true };

// Every app's groups, closed by Other for the keys no group claims.
export const NOTIFY_TYPES: Record<string, NotifyType[]> = Object.fromEntries(Object.entries(GROUPS).map(([app, groups]) => [app, [...groups, OTHER]]));

// The id of the group an app's event key belongs to.
export const typeOf = (app: string, key: string): string => (NOTIFY_TYPES[app] ?? []).find((g) => g.match(key))?.id ?? OTHER.id;
