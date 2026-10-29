// Notification types: groups of event keys inside an app that Settings can switch on and off one by one.
export interface NotifyType { id: string; label: string; match: (key: string) => boolean }

// Names are event keys without the "event." prefix; a trailing * matches every key that starts with the name.
const is = (...names: string[]) => (key: string) =>
  names.some((n) => (n.endsWith("*") ? key.startsWith(`event.${n.slice(0, -1)}`) : key === `event.${n}`));
const type = (label: string, ...names: string[]): NotifyType => ({ id: label.toLowerCase().replace(/[^a-z]+/g, "-"), label, match: is(...names) });

const GROUPS: Record<string, NotifyType[]> = {
  Finance: [type("Bills and tax", "bills", "monthStart", "tax", "taxLoss"), type("Cash and loans", "cashNegative", "bankrupt")],
  Bank: [type("Loans", "loanMissed", "loanCalled")],
  Support: [
    type("Tickets", "ticket", "tickets", "stepFailed", "offerDeclined"),
    type("Migration offers", "moveAccepted", "moveDeclined", "moveDone", "moveMissed"),
    type("Orders and sales", "order", "orderAccepted", "orderFailed", "orderPaid", "sales*"),
    type("Sponsoring requests", "sponsorRequest"),
    type("Notices and legal", "seized", "breach"),
    type("Power", "gridDark", "gridCarried"),
  ],
  Network: [
    type("Uplinks and peering", "uplinkReady", "peeringRequest"),
    type("Attacks and saturation", "ddos", "saturated"),
    type("Addresses", "addressListed"),
    type("Monthly bills", "networkBills"),
    type("Domains", "registrarTier", "domainsTransferred"),
  ],
  Locations: [
    type("Planned maintenance", "maintenanceStart", "maintenanceEnd"),
    type("Hardware failures", "componentFailed", "dataLoss", "dataCorrupted", "recovered", "serverHung", "bmcHung", "nodeFrozen", "nodeThawed"),
    type("Deliveries and moves", "rackArrived", "stockArrived", "drained", "spaceHeld", "holdExpired", "seizedBack"),
    type("Internet line", "lineReady", "lineFull"),
  ],
  Security: [type("Advisories", "vuln.announced", "vuln.poc", "vuln.warning", "vuln.patch"), type("Compromises", "vuln.hacked", "siteHacked", "siteLeft", "breachPress", "breachFine"), type("Open vulnerabilities", "vulnOpen", "vulnCritical")],
  Marketing: [type("Reviews", "review"), type("Campaigns and bills", "fairDone", "fairMissed", "marketingBills", "platformDropped"), type("Community events", "sponsorDone", "sponsorFailed")],
  Website: [type("Site", "siteDown")],
  Staff: [
    type("Hiring and leaving", "quit", "raise", "salaries"),
    type("Training", "trained", "trainerDone"),
    type("On call and tech", "onCallAbuse", "onCallBlackhole", "phpUpgraded", "techFailed", "techReplaced", "techInstalled", "techRemoved", "techUpdated", "botIncident*"),
  ],
  "Virtual machines": [type("Workloads and migrations", "failedOver", "failoverStuck")],
  Products: [type("Workloads and migrations", "migrated", "migrationFailed"), type("Backups", "backupFailed"), type("Installs", "installed", "switched")],
  Customers: [type("Orders and sign-ups", "orderPlaced", "friendsJoined")],
  Billing: [type("Payments and dunning", "collected", "invoices", "suspended", "suspendedLeft"), type("Domains", "domainExpired", "domainExpiring")],
  Research: [type("Unlocks", "trainingDone")],
  Shop: [type("Used market", "used*")],
  News: [type("Hardware", "news.generation", "news.endOfSale", "news.gpu"), type("Software", "news.software"), type("Internet", "news.ipv6*", "news.ripe*"), type("Market", "news.design", "news.line", "news.mail", "news.gpuDemand", "news.used*")],
};

const OTHER: NotifyType = { id: "other", label: "Other", match: () => true };

// Every app's groups, closed by Other for the keys no group claims.
export const NOTIFY_TYPES: Record<string, NotifyType[]> = Object.fromEntries(Object.entries(GROUPS).map(([app, groups]) => [app, [...groups, OTHER]]));

// The id of the group an app's event key belongs to.
export const typeOf = (app: string, key: string): string => (NOTIFY_TYPES[app] ?? []).find((g) => g.match(key))?.id ?? OTHER.id;
