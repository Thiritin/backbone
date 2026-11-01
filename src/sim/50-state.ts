import { createRng, type Rng } from "./00-core/rng";
import { componentParts, hasFirmware, homeLan, isManaged, isOfficeRouter, modelById, type ComponentKind, type FormFactor, type PartSpec } from "./10-catalog/hardware";
import type { BooksVendorId } from "./10-catalog/bookkeeping";
import type { Vendor } from "./10-catalog/cpus";
import type { LicenseKind, OsImage, ServerOsId } from "./10-catalog/server-os";
import { yearOf } from "./00-core/time";
import { MOMS_DSL, seedDcs } from "./20-world/datacenters";
import { t } from "../i18n/en";
import type { Customer, Product, Service } from "./30-customers/customers";
import type { Quote } from "./30-market/quotes";
import type { BillingRules, HoldReason, Invoice, Loan, Transfer } from "./45-billing/billing";
import type { Ticket } from "./40-support/tickets";
import type { Policy } from "./46-finance/finance";
import { applications, defaultTeams, type Candidate, type Employee, type Team } from "./47-staff/staff";
import type { OnCall } from "./47-staff/oncall";
import type { TechOp, TechRules } from "./47-staff/technicians";
import type { ActivityEntry } from "./47-staff/activity";
import { newMarketing, type Marketing } from "./80-business/marketing";
import type { Cluster, Workload } from "./60-infra/cluster";
import type { Daemon } from "./60-infra/daemons";
import type { GameServer } from "./60-infra/games";
import type { Maintenance } from "./60-infra/maintenance";
import type { FrontOp } from "./60-infra/power";
import { newNetwork, type Network } from "./60-infra/network";
import { newOps, type Ops } from "./60-infra/ops";
import { newSites, type Sites } from "./60-infra/apps";
import type { Breach } from "./60-infra/breach";
import { newSecurity, type Security } from "./60-infra/security";
import { newSales, type Sales } from "./30-market/market";
import { seedRivals, type Rival, type ShareEntry } from "./30-market/rivals";
import type { FairBooking } from "./80-business/fairs";
import type { Sponsorship } from "./80-business/community";
import type { SponsorOffer } from "./80-business/sponsorboard";
import type { LossReport } from "./85-products/products";
import type { Rates } from "./10-catalog/products";
import type { Domain } from "./30-customers/registry";
import { newChadUsage, type ChadUsage } from "./47-staff/chad";
import { newIps, type Ips } from "./60-infra/addresses";
import { newNetSvc, type NetSvc } from "./60-infra/netsvc";
import { newWebPanel, type WebPanel } from "./60-infra/webpanel";
import type { CompanyMail } from "./80-business/mail";
import type { Registrar } from "./30-customers/registrar";
import type { Listing } from "./10-catalog/used";
import { firstHostNo } from "./30-customers/hostnames";
import { newShop, type ShopState } from "./80-business/shop";
import type { BankAccount } from "./46-finance/bank";
import type { Payable } from "./46-finance/payables";
import type { Letter } from "./40-support/letters";
import type { TrendPoint } from "./80-business/trend";
import { newTax, type TaxState } from "./80-business/tax-state";

// 3: GPU line servers carry their preset cards. 4: an unregistered game holds its savings until the bank account opens.
export const SAVE_VERSION = 5;

export type BondMode = "none" | "failover" | "balance";
export type CableKind = "copper" | "dac" | "fiber" | "rollover";

export type SpaceKind = "basement" | "share" | "cage" | "suite";
// Each location is an availability zone (az, like fra2) in the region of its city.
export interface Location { id: string; dc: string | null; city: string; az: string; name: string; space: SpaceKind; positions: number; readyAt: number; extraCircuit: boolean }
// share-N racks belong to the provider of a rack share and hold N units.
export type RackModel = "rack-24" | "rack-42" | "rack-47" | "share-5" | "share-10" | "share-21" | "share-42";
// arriveAt is the hour a moving rack arrives; null when it is in place. A moving rack already holds its target location and position.
export interface Rack { id: string; model: RackModel; locationId: string; position: number; name: string; arriveAt: number | null; price: number; boughtAt: number; provided: boolean; feedB: boolean; highDensity: boolean; extraKw: number; extraKwAt: { kw: number; at: number } | null;
  // A flat-rate power contract's kW, 0 for metered, and a change booked for a later hour.
  flatKw: number; flatKwAt: { kw: number; at: number } | null;
  // The hour each feed went above its continuous load, null while below.
  overSince: { a: number | null; b: number | null } }
// slot is the lowest unit the device occupies, counted from 1 at the bottom.
// A datacenter handoff and the basement's line jack sit on their location's carrier panel: rackId null, panel = location id. A stored unit has store = its zone's location id;
// a shipped unit has store null and transitTo/arriveAt set until it arrives.
// docs/design/software.md, section 3: what a server's or own VM's disk holds. os null is an empty disk; a software whose
// doneAt is still ahead is installing. An OS whose installedAt is ahead is installing, or upgrading in place from the
// version in from.
export interface MachineState {
  os: { id: ServerOsId; version: string; installedAt: number; from?: string } | null;
  software: { id: string; version: string; installedAt: number; doneAt: number | null }[];
  // An OS install the network dropped out of, shown on the console until a key is pressed (software.md, section 4.2).
  installFailed?: NetFail;
}
export type NetFail = "noInterfaces" | "noLink";
// A managed switch port's VLANs: the one its untagged frames belong to and the ones it carries tagged. A port without an entry is untagged in VLAN 1.
// all carries every customer network tagged (60-infra/private.ts).
export interface PortVlan { untagged: number; tagged: number[]; all?: true }
export interface SwitchConfig { groups: number[][]; vlans: Record<number, PortVlan>; routed?: number[] }
export interface Device extends MachineState { id: string; model: string; brand: string; rackId: string | null; slot: number; panel: string | null; name: string; bond: BondMode; groups: number[][]; price: number; boughtAt: number; lease: string | null; store: string | null; transitTo: string | null; arriveAt: number | null;
  components: Component[]; on: boolean; label: string | null; raid: RaidLevel; rebuildRate: RebuildRate;
  // others are the further CPUs a swap of every socket replaces with the same spec.
  rebuild: { componentId: string; doneAt: number } | null; maintenance: { componentId: string; partId: string; doneAt: number; spec?: PartSpec; others?: string[]; mount?: true } | null;
  // The hour the device's data was lost, if it ever was.
  dataLost: number | null;
  // The hour a device switched on finishes booting.
  bootUntil?: number;
  // The hour a clean shutdown switches the device off.
  haltUntil?: number;
  // The operating system froze (hung) or the management controller did (bmcHung); log is the device's last 20 events.
  hung: boolean; bmcHung: boolean; log: { hour: number; key: string }[];
  // The chassis a multi-node server's node sits in; it mounts, moves and gets power with it.
  chassisId: string | null;
  // A hand task waiting for someone on site: pulling the plug or resetting the management controller.
  hands?: { kind: FrontOp | "bmcreset" | "continue" | "recover" | "stick"; doneAt: number } | null;
  // Remote access (60-infra/oob.ts): a server waiting at the firmware prompt (latent while off), a switch or router that locked
  // the player out, an ATX power adapter fitted for a console-only KVM, the own way in of a console server or OOB switch,
  // and the firmware release of network and management gear.
  stuck: boolean; locked: boolean; atx?: true; uplink?: "dsl" | "modem"; fw?: { version: number; updatedAt: number };
  // The server sits in its BIOS setup (90-actions/console.ts): the boot waits until the player leaves it. bootFrom is what
  // this boot came from: the USB stick shows the installer in place of the operating system.
  setup: boolean; bootFrom: "disk" | "usb";
  // A managed switch's running configuration is groups and vlans; saved is what it loads when it boots.
  vlans?: Record<number, PortVlan>; saved?: SwitchConfig;
  // The VLANs a layer 3 switch routes between, each with an interface on the switch.
  routed?: number[];
  // The image mounted through the management controller (90-actions/media.ts); it boots like the USB stick without a visit.
  virtualMedia?: OsImage;
  // What a spare part in storage is (size and form factor); spares without it fit any slot of their kind.
  part?: PartSpec;
  // nodeNNN, set on servers.
  hostname?: string;
  // Bought on the used market: no insurance covers it.
  used?: true;
  // A burn-in test running until the hour; full is the long one. burnedInAt is the hour a full burn-in passed.
  burnin: { until: number; full: boolean } | null; burnedInAt: number | null;
  // Buyer protection from a board or eBuy purchase: the first failure before the hour refunds this much.
  refund?: { until: number; amount: number } | null;
  // thermal.ts: the game minute the server shut itself off from heat, and the hours it ran throttling hot.
  overheatedAt?: number; hotHours?: number;
  // A small-office router's home network (docs/design/lan.md); a datacenter handoff stores only once it hands out leases.
  lan?: RouterLan;
  // A server's network setting as its OS stores it, and the one ip or ifdown set since boot (lan.md, Shell): it holds only
  // while bootUntil is still the boot it was set in, so the next boot drops it.
  iface?: IfaceConfig; runtime?: IfaceConfig & { down?: true; boot: number | null };
}
// DHCP, or a static address with its prefix, gateway and name server; static without ip leaves the interface unconfigured.
export interface IfaceConfig { mode: "dhcp" | "static"; ip?: string; prefix?: number; gw?: string; dns?: string }
// A router's range, DHCP pool and lease time, the addresses it always gives the same device, its live leases (until is the
// hour a lease runs out) and its port shares, each pointing at an address on the network.
export interface RouterLan {
  cidr: string; gateway: string; pool: [string, string]; leaseHours: number;
  // Remote access: the desk reaches the network behind an own datacenter router over its VPN.
  vpn?: boolean;
  reservations: { mac: string; ip: string }[]; leases: { mac: string; ip: string; until: number; name: string }[]; shares: PortShare[];
}
export interface PrivateNet { customerId: string; vlan: number; since: number }
export interface PortShare { ip: string; kind: "web" | "exposed" }
// paid counts the monthly payments made so far; the lease ends after months payments.
export interface Lease { id: string; lessor: string; monthly: number; months: number; startedAt: number; paid: number; devices: string[] }
// A waitlist entry gets heldUntil once its space is free; the space is then reserved until that hour.
// A rented space's contract with its provider. monthly is the rent agreed at order time; endsAt is set once the player
// gives notice and the location closes at that hour.
export interface Contract { id: string; provider: string; dc: string; locationId: string; space: "share" | "cage" | "suite"; positions: number; since: number; monthly: number; endsAt: number | null }
export interface WaitlistEntry { id: string; dc: string; space: "share" | "cage" | "suite"; size: number; since: number; heldUntil: number | null }
export interface End { device: string; port: number }
export interface Cable { id: string; a: End; b: End; kind: CableKind; color: string | null }
// failedAt is the hour the component broke; null while it works. A power supply is plugged in unless plugged is false.
// size is GB for RAM sticks and drives, cores for CPUs; ff is the form factor of a drive. CPUs and boards carry their vendor,
// CPUs their generation (1 for G1).
// wear is what a used part's owner knows of it: hidden until a burn-in, or worn after a quick one; unset once known.
export interface Component { id: string; kind: ComponentKind; installedAt: number; failedAt: number | null; wear?: "hidden" | "worn"; plugged?: boolean; size?: number; ff?: FormFactor; vendor?: Vendor; gen?: number; sku?: string }
export type RaidLevel = "none" | "1" | "5" | "6" | "10";
export type RebuildRate = "low" | "medium" | "high";
// since is the hour of the first change; a data loss after it wipes the changes. A path maps to a file's text, true for a
// directory, or false for a base entry that was deleted.
export interface HostFiles { since: number; paths: Record<string, string | boolean> }

// A desktop document; x and y are its icon position on the desktop in pixels.
// An "app" doc is a desktop link whose title is the app name; a "form" doc is a downloaded application to sign.
export interface Doc { id: string; kind: "guide" | "note" | "app" | "form"; title: string; body: string; x: number; y: number; form?: DocForm }
// from is the legal form the company held when the form was downloaded.
export interface DocForm { form: string; from?: string; signed: number | null }
// domain is the company's own domain once registered; mail is its email service.
export interface Company { name: string; logo: string; color: string; domain: string | null; mail: CompanyMail; tagline: string }
export interface Registration { hour: number; owner: string; form: string; number: number }
export interface LedgerEntry { hour: number; category: string; key: string; params: Record<string, string | number>; amount: number }

// A licence key for an OS or software id. edition is a panel tier; kind is the pricing at purchase. covers is the major
// version a one-time key is bound to, or the hour a subscription's paid term runs to; renewsAt is the next renewal of a
// subscription and lapsedAt the hour an unpaid one expired.
export interface Licence {
  id: string; product: string; edition: string | null; kind: LicenseKind; key: string; orderId: string; boughtAt: number;
  machineId: string | null; covers: { kind: "version"; major: string } | { kind: "term"; until: number };
  renewsAt: number | null; lapsedAt: number | null;
}

export interface GameState {
  version: number;
  seed: number;
  rng: Rng;
  hour: number;
  minute: number;
  cash: number;
  nextId: number;
  locations: Location[];
  racks: Rack[];
  devices: Device[];
  cables: Cable[];
  ledger: LedgerEntry[];
  // Bought licence keys (docs/design/plans/software-licences.md), each assigned to at most one machine.
  licenses: Licence[];
  // One entry per machine and product whose trial started; it never starts again there. until is the hour it ends.
  trials: { machineId: string; product: string; until: number }[];
  // Operating system images downloaded from their sites, one per version, and the one USB stick: the image written on it,
  // the server it is in.
  media: { images: OsImage[]; stick: { os: OsImage | null; in: string | null } };
  leases: Lease[];
  // Power drawn since the last monthly bill, in euros.
  powerDue: number;
  customers: Customer[];
  services: Service[];
  // Billing and bank.
  invoices: Invoice[];
  // Bank transfers from customers, matched to invoices by hand in Books.
  transfers: Transfer[];
  // Quotes written in Books for order tickets.
  quotes: Quote[];
  // Hour up to which each yearly service is invoiced.
  yearlyBilledUntil: Record<string, number>;
  loans: Loan[];
  // A missed repayment blocks new loans until this hour.
  loansBlockedUntil: number;
  billingRules: BillingRules;
  // Whether accepted orders run from account to setup by themselves (needs the provisioning skill).
  autoOrders: boolean;
  // Whether server orders wait for a review by hand (45-billing/fraud.ts).
  reviewOrders: boolean;
  // Whether MaxMined screens standard orders (needs the fraudScreening skill), and the checks billed next month start.
  screenOrders: boolean;
  screenChecks: number;
  // How many monthly checks in a row the payment provider found too many chargebacks: 1 warned, 2 higher fees.
  chargebackStrikes: number;
  // The shop system that takes orders, its modules and stock (docs/design/shop.md).
  shop: ShopState;
  // Customers whose services the player holds offline.
  heldCustomers: string[];
  // Customer private networks, each a VLAN on the player's switches (60-infra/private.ts).
  privateNets: PrivateNet[];
  // Panel hosts: services the player holds offline one by one, with the reason shown in the consoles.
  heldServices: Record<string, HoldReason>;
  // Game servers: the title, slots and state of each game server service on a game panel.
  gameServers: GameServer[];
  // Pterodaktyl: the node daemons by node.
  daemons: Record<string, Daemon>;
  // Support: tickets, the minute the player's queued replies finish, and the hour each offline service went down.
  tickets: Ticket[];
  playerBusyUntil: number;
  // Favours asked of friends for datacenter hand work in a calendar year.
  friendFavours: { year: number; used: number };
  // Where the player is, and until which hour the drive there or the hand work on site keeps the computer locked.
  player: { at: string; until: number; doing: "travel" | "work" };
  downSince: Record<string, number>;
  // Cluster nodes frozen because their RAM in use exceeds the installed RAM.
  frozen: string[];
  // The basement's internet line (HOME_LINES or MOMS_DSL id, "" for none), a switch to another line that goes live at hour at, and whether this line ran full.
  homeLine: { id: string; next: { id: string; at: number } | null; full?: boolean };
  docs: Doc[];
  // Positions rented by competitors in each datacenter.
  dcs: Record<string, { others: number }>;
  waitlist: WaitlistEntry[];
  contracts: Contract[];
  // Learned research skills (SKILLS ids).
  unlocks: string[];
  // The skill in training and the hour it is learned.
  training: { id: string; doneAt: number } | null;
  // Know-how points to spend on research.
  knowHow: number;
  // Apps in the dock and bought Pear Store upgrades; every Pear Store item here is billed monthly.
  installed: string[];
  // Knowledge base article reads by how-to topic, each one a ticket the customer did not write.
  kbReads: Record<string, number>;
  // Checklist goals the player ticked by hand.
  checklist: string[];
  // The changelog entries (date|text) the player has been shown.
  seenChanges: string[];
  // Installed apps the player took out of the dock.
  undocked: string[];
  // Pear OS release the desktop runs; it sets the look of the shell.
  os: string;
  company: Company;
  // Finance: loss carried to the next tax year, insurance policies, the hour cash went below zero and the hour of bankruptcy.
  taxLoss: number;
  insurance: Policy[];
  brokeSince: number | null;
  gameOver: number | null;
  // Employees and the job market.
  staff: Employee[];
  // Teams and their weekly shifts; every employee belongs to one.
  teams: Team[];
  candidates: Candidate[];
  // What staff and the player did for each customer, oldest first.
  activity: ActivityEntry[];
  // Operations queued for technicians, oldest first, and the repairs they queue by themselves.
  techOps: TechOp[];
  techRules: TechRules;
  onCall: OnCall;
  marketing: Marketing;
  fairs: FairBooking[];
  // Community sponsoring requests and the events running on free services.
  sponsorships: Sponsorship[];
  // Offers posted on the Sponsor-Bored board; their applications are sponsorships with a board.
  sponsorOffers: SponsorOffer[];
  clusters: Cluster[];
  workloads: Workload[];
  // Sales requests and lost sales (30-market).
  sales: Sales;
  // The player's price per resource unit by line (Products app); unset units charge the market rate.
  rates: Partial<Record<Product, Rates>>;
  // Hours each service has been down since the last monthly invoice.
  downHours: Record<string, number>;
  // Planned maintenance windows that have not ended yet.
  maintenance: Maintenance[];
  network: Network;
  // Incidents, seized servers, dark locations and taken-down services.
  ops: Ops;
  // Incident reports of lost disks.
  lossReports: LossReport[];
  // PHP security advisories and the nodes patched, offline or compromised.
  security: Security;
  // Terminal files the player changed, per machine ("desk" or a device id) (60-infra/fs.ts).
  files: Record<string, HostFiles>;
  // Customer data stolen from a host, the ransom decision and the fine that follows a sale (60-infra/breach.ts).
  breaches: Breach[];
  // Customer sites defaced, their hacks and the customers written to (60-infra/apps.ts).
  sites: Sites;
  // Domains registered or transferred for customers (30-customers/registry.ts).
  domains: Domain[];
  // The registrar partner under contract (30-customers/registrar.ts); null before the first contract.
  registrar: Registrar | null;
  // ChadGPT replies this month, billed at the next month start.
  chadUsage: ChadUsage;
  // Public addresses, the LIR membership and its blocks (60-infra/addresses.ts).
  ips: Ips;
  // Mail queues and broken DNS, certificates and storage sets of the infrastructure consoles (60-infra/netsvc.ts).
  netsvc: NetSvc;
  // PHP pools, certificates, bans, transfers and resellers of the web panel consoles (60-infra/webpanel.ts).
  webpanel: WebPanel;
  // News already published, as "<id>@<hour>" (80-business/news.ts).
  news: string[];
  competitors: Rival[];
  shareLog: ShareEntry[];
  // Next server number, next own-VM number and next service number (30-customers/hostnames.ts).
  nextNode: number;
  nextVm: number;
  nextHostNo: number;
  // The used hardware market's listings, the player's own among them, and the player's reputation on the board (80-business/used.ts).
  used: Listing[];
  usedRep: number;
  // Every successful player action, oldest first, so the run can be replayed (90-actions/index.ts).
  log: LogEntry[];
  // The weekly challenge this game was started for (10-catalog/challenges.ts), null for a free game.
  challenge: string | null;
  // Leaderboard scores (80-business/scores.ts): net worth at the end of 2007, the hour level 3 was reached and the summed hourly mean happiness.
  score: Score;
  // A daily reading of customer count and mean happiness, oldest first (80-business/trend.ts).
  trend: TrendPoint[];
  // The trade office registration (80-business/office.ts); null until the player registers, which installs the starter apps.
  registration: Registration | null;
  // Apps that arrived by their trigger (80-business/walk.ts), installed or offered once.
  arrived: string[];
  // The company's bank account (46-finance/bank.ts); null until the registration opens it.
  bank: BankAccount | null;
  // Supplier invoices to pay by transfer (46-finance/payables.ts).
  payables: Payable[];
  // Paper post, delivered and on its way (40-support/letters.ts).
  letters: Letter[];
  // The last calendar year the chamber of commerce billed; 0 before the first bill (80-business/paperwork.ts).
  chamberYear: number;
  // Bought software modules by id; "hbci" lets Books talk to the bank.
  modules: string[];
  // The bookkeeping program the Books app runs (10-catalog/bookkeeping.ts); null until one is installed.
  books: { vendor: BooksVendorId | null; installedAt: number };
  // The tax office's file on the company (80-business/tax.ts).
  tax: TaxState;
}

export interface LogEntry { hour: number; minute?: number; name: string; args: unknown[] }
export interface Score { netWorth: number | null; level3: number | null; happySum: number; happyHours: number }

// Fields every new device starts with: fresh components installed at hour `at` (the model's parts unless partList says otherwise), powered on, RAID 1 with two or more drives.
export function deviceDefaults(modelId: string, at: number, partList?: PartSpec[]) {
  const parts = partList ?? componentParts(modelById(modelId));
  const drives = parts.filter((p) => p.kind === "hdd" || p.kind === "ssd" || p.kind === "nvme").length;
  return {
    components: parts.map((p, i): Component => ({ id: `c${i + 1}`, ...p, installedAt: at, failedAt: null })),
    on: true, label: null, raid: (drives >= 2 ? "1" : "none") as RaidLevel, rebuildRate: "medium" as RebuildRate,
    rebuild: null, maintenance: null, dataLost: null, burnin: null as Device["burnin"], burnedInAt: null as number | null, chassisId: null as string | null,
    hung: false, bmcHung: false, log: [] as { hour: number; key: string }[], os: null as MachineState["os"], software: [] as MachineState["software"],
    stuck: false, locked: false, setup: false, bootFrom: "disk" as const, ...(hasFirmware(modelById(modelId)) ? { fw: { version: yearOf(at), updatedAt: at } } : {}),
    ...(isOfficeRouter(modelById(modelId)) ? { lan: homeLan() } : {}),
    ...(modelById(modelId).kind === "server" ? { iface: { mode: "dhcp" } as IfaceConfig } : {}),
    ...(isManaged(modelById(modelId)) ? { vlans: {} as Record<number, PortVlan>, saved: { groups: [], vlans: {} } as SwitchConfig } : {}),
  };
}

// Sizes for components saved before parts had them: the nth component of a kind takes the nth part of that kind in the model's preset.
export function fillSizes(modelId: string, components: Component[]): Component[] {
  const preset = componentParts(modelById(modelId)), seen: Partial<Record<ComponentKind, number>> = {};
  return components.map((c) => {
    const p = preset.filter((x) => x.kind === c.kind)[seen[c.kind] = (seen[c.kind] ?? -1) + 1];
    return c.size === undefined && p?.size !== undefined ? { ...c, size: p.size, ...(p.ff ? { ff: p.ff } : {}), ...(c.kind === "board" && p.gen ? { gen: p.gen } : {}) } : c;
  });
}

// GPU line servers saved before cards were parts get their preset's cards, installed with the device's oldest part.
export function fillCards(modelId: string, components: Component[]): Component[] {
  const cards = componentParts(modelById(modelId)).filter((p) => p.kind === "gpu");
  if (!cards.length || components.some((c) => c.kind === "gpu")) return components;
  const top = Math.max(0, ...components.map((c) => Number(c.id.slice(1)) || 0)), at = Math.min(...components.map((c) => c.installedAt));
  return [...components, ...cards.map((p, i): Component => ({ id: `c${top + i + 1}`, ...p, installedAt: Number.isFinite(at) ? at : 0, failedAt: null }))];
}

export const device = (id: string, model: string, brand: string, rackId: string | null, slot: number, panel: string | null, name: string, price: number): Device =>
  ({ id, model, brand, rackId, slot, panel, name, bond: "none", groups: [], price, boughtAt: 0, lease: null, store: null, transitTo: null, arriveAt: null, ...deviceDefaults(model, 0) });

// Starting infrastructure: an empty 24U basement rack, the line jack on its panel and the flat's router in storage. The player
// mounts the router, buys, mounts and cables the first server.
export const newGame = (seed: number): GameState => ({
  version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, minute: 0, cash: 0, nextId: 8,
  locations: [{ id: "loc1", dc: null, city: "Frankfurt", az: "fra1", name: t("location.basement"), space: "basement", positions: 1, readyAt: 0, extraCircuit: false }],
  racks: [{ id: "rack2", model: "rack-24", locationId: "loc1", position: 1, name: "fra1-rack-01", arriveAt: null, price: 350, boughtAt: 0, provided: false, feedB: false, highDensity: false, extraKw: 0, extraKwAt: null, flatKw: 0, flatKwAt: null, overSince: { a: null, b: null } }],
  devices: [{ ...device("dev5", "home-router", "AVN", null, 0, null, "fra1-gw-01", 0), store: "loc1" }, device("dev6", "line-jack", "", null, 0, "loc1", "fra1-line-01", 0)],
  cables: [],
  ledger: [], licenses: [], trials: [], media: { images: [], stick: { os: null, in: null } }, leases: [], powerDue: 0, docs: [guideDoc()], dcs: seedDcs(seed, 2005), waitlist: [], contracts: [], unlocks: [], training: null, knowHow: 0, installed: ["Browser", "Chat"], kbReads: {}, checklist: [], seenChanges: [], undocked: [], os: "aqua",
  customers: [], services: [], clusters: [], workloads: [], downHours: {}, maintenance: [], lossReports: [], files: {},
  invoices: [], transfers: [], yearlyBilledUntil: {}, loans: [], loansBlockedUntil: 0,
  quotes: [],
  billingRules: { autoRemind: false, autoSuspendDays: 0, autoCollectDays: 0 }, autoOrders: false, reviewOrders: false, screenOrders: false, screenChecks: 0, chargebackStrikes: 0,
  shop: newShop(),
  heldCustomers: [],
  privateNets: [],
  heldServices: {},
  gameServers: [],
  daemons: {},
  tickets: [], playerBusyUntil: 0, friendFavours: { year: 0, used: 0 }, player: { at: "loc1", until: 0, doing: "work" }, downSince: {}, frozen: [],
  company: { name: "Basement Hosting", logo: "server", color: "oklch(0.55 0.15 255)", domain: null, mail: { kind: "free" }, tagline: "" },
  homeLine: { id: MOMS_DSL.id, next: null },
  taxLoss: 0, insurance: [], brokeSince: null, gameOver: null,
  staff: [], teams: defaultTeams(), candidates: applications(seed, 0), activity: [], techOps: [], techRules: { failed: true, worn: false, blackhole: true, updates: false, recover: true }, onCall: { roster: [], lastCall: {}, month: {} },
  marketing: newMarketing(), fairs: [], sponsorships: [], sponsorOffers: [],
  network: newNetwork(),
  ops: newOps(),
  security: newSecurity(),
  breaches: [],
  sites: newSites(),
  sales: newSales(),
  rates: {},
  domains: [],
  registrar: null,
  chadUsage: newChadUsage(),
  ips: newIps(),
  netsvc: newNetSvc(),
  webpanel: newWebPanel(),
  news: [],
  competitors: seedRivals(seed),
  shareLog: [],
  nextNode: 1, nextVm: 1, nextHostNo: firstHostNo(seed),
  used: [], usedRep: 0,
  log: [], challenge: null, registration: null, arrived: [], score: { netWorth: null, level3: null, happySum: 0, happyHours: 0 }, trend: [],
  bank: null,
  payables: [],
  letters: [],
  chamberYear: 0,
  modules: [],
  books: { vendor: null, installedAt: 0 },
  tax: newTax(),
});

export const guideDoc = (): Doc => ({ id: "guide", kind: "guide", title: t("doc.guide"), body: "", x: 16, y: 46 });
