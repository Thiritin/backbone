import { migrateBooks } from "./books";
import { fillShop } from "./shop";
import { brandsOf, fillCpus, isOfficeRouter, MODELS, modelById, RENAMED_MODELS, wanPort } from "../10-catalog/hardware";
import { freeSlots } from "../60-infra/status";
import { legacyLicences } from "../60-infra/licence";
import { leave } from "../90-actions/clusters";
import { yearOf } from "../00-core/time";
import { asImage } from "../10-catalog/server-os";
import { capacityAt, DATACENTERS, DEFAULT_HOME_LINE, LEAD_DAYS, nextAz, seedDcs, SHARE_RACKS, spacePrice } from "../20-world/datacenters";
import { fillAddresses } from "../60-infra/addresses";
import { mergeWebPanel } from "../60-infra/webpanel";
import { fillBackups } from "../60-infra/backups";
import { skillById, skillFor } from "../10-catalog/research";
import { STARTER_APPS, WIDGETS } from "../10-catalog/store";
import { legacyRegistration } from "../80-business/office";
import { legacyTax } from "../80-business/tax";
import { legacyBank, savingsOf } from "../46-finance/bank";
import { bankById, defaultPlan } from "../10-catalog/banks";
import type { Employee } from "../47-staff/staff";
import { device, deviceDefaults, fillCards, fillSizes, newGame, SAVE_VERSION, type Device, type GameState, type Location } from "../50-state";
import { dropCluster, workloadDefaults } from "../60-infra/cluster";
import { upgradeCompute } from "./compute";
import { fillDomains } from "../30-customers/domains";
import { homeAddress } from "../30-customers/addresses";
import { authCode } from "../30-customers/registry";
import { fillHostnames } from "../30-customers/hostnames";
import { fillRegistrar } from "../30-customers/registrar";
import { fillDesign, fillLaunch, fillLines } from "../80-business/website";
import { fillSpecs } from "./specs";
import { fillDaemons } from "../60-infra/daemons";
import { fillGames } from "../60-infra/games";
import { fillMachines, fillVersions } from "./machines";
import { legacyLeads } from "./leads";

// ponytail: plain JSON in localStorage; compress once saves approach the ~5 MB limit.
export const serialize = (state: GameState): string => JSON.stringify(state);

const REPAIR_FLOOR = 0.8;

const learned = (id: string): string[] => {
  const skill = skillById(id) ?? skillFor(id);
  return skill ? [...skill.needs.flatMap(learned), skill.id] : [id];
};
const INFRA = ["nextId", "locations", "racks", "devices", "cables"] as const;

// Old saves keep loading: every field missing from a save takes its new-game default.
// A version 1 save (no rack in the basement, or no infrastructure at all) gets the version 2 starting infrastructure.
export function deserialize(raw: string): GameState {
  const data = JSON.parse(raw) as Partial<GameState>;
  if (typeof data.seed !== "number") throw new Error("save has no seed");
  // Machines saved before operating systems.
  const bare = new Set([...(data.devices ?? []), ...(data.workloads ?? [])].filter((m) => m.os === undefined).map((m) => m.id));
  const base = newGame(data.seed);
  if ((data.version ?? 1) < 2) for (const k of INFRA) delete data[k];
  // Hardware insurance is gone; repairs cost what they cost.
  delete (data as { insurance?: unknown }).insurance;
  const locations: GameState["locations"] = [];
  // The basement's tower shelf is gone, and rack positions became cages.
  for (const { shelf: _, ...l } of (data.locations ?? base.locations) as (Location & { shelf?: number })[]) {
    locations.push({ ...l, space: (l.space as string) === "positions" ? "cage" : l.space, az: l.az ?? nextAz(locations, l.city), extraCircuit: l.extraCircuit ?? false });
  }
  // Older saves had one stockroom; its units go to the first location.
  const stored = (d: Device) => d.store !== undefined ? d.store : !d.rackId && !d.panel ? locations[0].id : null;
  const known = (d: { model: string }) => MODELS.some((m) => m.id === (RENAMED_MODELS[d.model] ?? d.model));
  const gone = new Set((data.devices ?? []).filter((d) => !known(d)).map((d) => d.id));
  // Old devices get the components of their model, installed when they were bought.
  // Saves from builds that could draw no maker hold units without a brand.
  const maker = (model: string, brand: string | undefined) => brand ?? brandsOf(modelById(model))[0];
  const devices = (data.devices ?? base.devices).filter(known).map((d) => {
    const model = RENAMED_MODELS[d.model] ?? d.model;
    const defaults = deviceDefaults(model, d.boughtAt ?? 0);
    // UPS units, PDUs and console gear saved before they had power supplies get their model's.
    const parts = d.components && !d.components.some((c) => c.kind === "psu") ? [...d.components, ...defaults.components.filter((c) => c.kind === "psu")] : d.components;
    const sized = fillCpus(modelById(model), fillSizes(model, parts ?? defaults.components));
    return {
      ...defaults, ...d, log: (d.log ?? []).map((e, i) => ({ ...e, sev: e.sev ?? "info", id: e.id ?? i })), model, brand: model === "home-router" ? "AVN" : maker(model, d.brand), components: (data.version ?? 1) < 3 ? fillCards(model, sized) : sized, lease: d.lease ?? null, store: stored(d), transitTo: d.transitTo ?? null, arriveAt: d.arriveAt ?? null,
      // A managed switch saved before configurations were saved boots into what it runs.
      ...(defaults.saved && !d.saved ? { saved: { groups: d.groups ?? [], vlans: d.vlans ?? {} } } : {}),
    };
  });
  const racks = (data.racks ?? base.racks).map((r) => ({ ...r, provided: r.provided ?? false, feedB: r.feedB ?? false, highDensity: r.highDensity ?? false, extraKw: r.extraKw ?? 0, extraKwAt: r.extraKwAt ?? null, flatKw: r.flatKw ?? 0, flatKwAt: r.flatKwAt ?? null, overSince: r.overSince ?? { a: null, b: null } }));
  const cables = (data.cables ?? base.cables).map((c) => ({ ...c, color: c.color ?? null }));
  // Competitors fill datacenters the save has not seen yet as if the game had started this year. A datacenter far below
  // last year's capacity can't come from play (competitors refill every month), so it is reseeded for this year too.
  const year = yearOf(data.hour ?? 0);
  const seeded = seedDcs(data.seed, year);
  const dcs = Object.fromEntries(DATACENTERS.map((dc) => {
    const kept = data.dcs?.[dc.id];
    return [dc.id, kept && kept.others >= REPAIR_FLOOR * capacityAt(dc, year - 1) ? kept : seeded[dc.id]];
  }));
  // Saves from before addresses get theirs.
  const fill = data.ips ? (x: GameState) => x : fillAddresses;
  const s = fillMachines(dropGone(gone, fillRegistrar(fill(fillLaunch(fillDesign(fillLines(fillHostnames(upgradeCompute(fillDomains(fillSpecs({
    ...base, ...data, dcs, locations, devices, racks, cables, rng: { ...base.rng, ...data.rng }, version: SAVE_VERSION,
    billingRules: { ...base.billingRules, ...data.billingRules },
    waitlist: (data.waitlist ?? []).filter((w: { space: string }) => w.space !== "positions"),
    // Saves from before contracts get one per rented location at today's price.
    contracts: data.contracts ?? locations.filter((l) => l.dc).map((l, i) => {
      const dc = DATACENTERS.find((d) => d.id === l.dc)!;
      const space = l.space as "share" | "cage" | "suite";
      const size = space === "share" ? SHARE_RACKS.find((m) => m.id === racks.find((r) => r.locationId === l.id && r.provided)?.model)?.size ?? 1 : l.positions;
      return { id: `contract-old-${i}`, provider: dc.provider, dc: dc.id, locationId: l.id, space, positions: size, since: l.readyAt - 24 * LEAD_DAYS[space], monthly: spacePrice(dc, space, size), endsAt: null };
    }),
    // Saves from before free mail had no mail service at all.
    company: { ...base.company, ...data.company, ...((data.company?.mail as { kind: string } | undefined)?.kind === "none" && { mail: base.company.mail }) },
    score: { ...base.score, ...data.score },
    network: { ...base.network, ...data.network },
    ops: { ...base.ops, ...data.ops },
    friendFavours: { ...base.friendFavours, ...data.friendFavours },
    player: data.player ?? { ...base.player, at: locations[0].id },
    security: { ...base.security, ...data.security },
    sites: { ...base.sites, ...data.sites },
    // Saves from before paid lines had the free DSL line from the start.
    homeLine: data.homeLine ?? { id: DEFAULT_HOME_LINE, next: null },
    // Saves from before the trade office count as registered in the first hour.
    registration: data.registration === undefined ? legacyRegistration(base.seed) : data.registration,
    ips: { ...base.ips, ...data.ips },
    netsvc: { ...base.netsvc, ...data.netsvc },
    webpanel: mergeWebPanel(base.webpanel, data.webpanel),
    marketing: { ...base.marketing, ...data.marketing, awareness: { ...base.marketing.awareness, ...data.marketing?.awareness } },
    // Saves from before the Pear Store keep every widget they showed.
    // The Research app was called Unlocks.
    // The Sales app moved into Support and the Checklist into Getting started, so their ids are dropped; saves from before the Website app get it in the dock. Customers moved into Books and the shop admin, and registered saves get every starter app.
    // Billing became Books.
    installed: data.installed ? [...new Set([...data.installed.map((id) => (id === "Unlocks" ? "Research" : id === "Billing" || id === "Finance" ? "Books" : id)).filter((id) => id !== "Sales" && id !== "Customers" && id !== "Checklist" && id !== "Bank" && id !== "dockBadges" && id !== "Products" && id !== "Virtual machines" && id !== "Website"), "Browser", "Chat", ...(data.registration !== null ? STARTER_APPS : [])])] : [...STARTER_APPS, "Chat", ...WIDGETS.map(([id]) => id)],
    // Older saves researched Pear Store items directly; each becomes its skill and that skill's prerequisites.
    unlocks: [...new Set((data.unlocks ?? []).flatMap(learned))],
    customers: (data.customers ?? []).map((c) => ({ ...c, history: c.history ?? [], credit: c.credit ?? 0, address: c.address ?? homeAddress({ seed: base.seed, locations }, Number(c.id.slice(3)) || 0, c.name, c.profile) })),
    tickets: (data.tickets ?? []).map((t) => ({ ...t, assignee: t.assignee ?? null })),
    services: (data.services ?? []).map((v) => ({ ...v, zone: v.zone ?? null, sla: v.sla ?? "basic" })),
    // Saves from before clusters keep their services unplaced, which leaves them online.
    sales: { ...base.sales, ...data.sales },
    // Rivals saved before small rivals, reviews and HOSTtoast.
    competitors: (data.competitors ?? base.competitors).map((r) => ({
      ...r, weak: r.weak ?? 0, reviews: r.reviews ?? [], down: r.down ?? [],
      tier: r.tier ?? base.competitors.find((x) => x.id === r.id)?.tier ?? "registered", badges: r.badges ?? base.competitors.find((x) => x.id === r.id)?.badges ?? 0,
    })),
    hosttoast: { ...base.hosttoast, ...data.hosttoast },
    shop: { ...base.shop, ...data.shop },
    used: (data.used ?? base.used).filter(known).map((l) => ({ ...l, model: RENAMED_MODELS[l.model] ?? l.model, brand: maker(RENAMED_MODELS[l.model] ?? l.model, l.brand), ...(l.device && { device: { ...l.device, brand: maker(l.device.model, l.device.brand) } }) })),
    staff: (data.staff ?? []).map(({ hours: _h, hoursFrom: _f, ...e }: Employee & { hours?: number; hoursFrom?: number }) => ({ ...e, location: e.location ?? null, team: e.team ?? "office", worked: e.worked ?? 0 })),
    techRules: { ...base.techRules, ...data.techRules },
    // upgradeCompute fills the cluster defaults.
    clusters: data.clusters ?? [], workloads: (data.workloads ?? []).map((w) => workloadDefaults({ ...w, media: w.media && asImage((w.media as string) === "iso" ? "lunix" : w.media, year) })), downHours: data.downHours ?? {},
    invoices: (data.invoices ?? []).map((i) => ({ ...i, suspendedAt: i.suspendedAt ?? (i.suspended ? data.hour ?? 0 : null), extendedUntil: i.extendedUntil ?? null })),
  })))), data.marketing?.lines), data.marketing?.designYear), data.marketing?.launched)), data.registrar)), bare);
  fillBackups(s);
  legacyLeads(s);
  // Saves from before the registrar form get the transfer code in the order email of an owned domain.
  s.sales = { ...s.sales, requests: s.sales.requests.map((r) => (r.owned && !r.thread[0]?.params.auth ? { ...r, thread: r.thread.map((m, i) => (i ? m : { ...m, params: { ...m.params, auth: authCode(s.seed, r.id) } })) } : r)) };
  fillShop(s, data.marketing?.owned);
  // Saves from before banks hold their account at Sparklasse; the next hour brings its welcome email and TAN list.
  if (data.bank === undefined) s.bank = legacyBank(s);
  // Accounts from before plans get their bank's cheapest plan for the form.
  if (s.bank && !s.bank.plan) s.bank = { ...s.bank, plan: defaultPlan(bankById(s.bank.id)!, s.registration?.form ?? "sole") };
  fillGames(s);
  fillDaemons(s);
  // A save from before accounts opened on the bank's site holds the savings as cash; they come back with the account.
  if ((data.version ?? 1) < 4 && !s.registration && !s.bank && s.cash >= savingsOf(s)) s.cash -= savingsOf(s);
  // Saves from before the account could come first opened it only after the customer accepted.
  if ((data.version ?? 1) < 5) s.sales = { ...s.sales, requests: s.sales.requests.map((r) => (r.kind === "order" && r.customerId && ["open", "countered", "refused"].includes(r.status) ? { ...r, status: "accepted" } : r)) };
  shelveRouter(s);
  fillVersions(s);
  // Saves from before licence keys; machines from before one-time licenses hold theirs for free, since the fee was never charged.
  if (!data.trials) legacyLicences(s, (data.licenses ?? []) as unknown as Parameters<typeof legacyLicences>[1]);
  const media = data.media ?? base.media;
  s.media = { images: [...new Set(media.images.map((x) => asImage(x, year)))], stick: { ...media.stick, os: media.stick.os && asImage(media.stick.os, year) } };
  s.arrived = data.arrived ?? [];
  // Saves from before the Bookkeeping category run Lexwear Office when they have Books.
  if (!data.books) s.books = { vendor: data.installed?.some((id: string) => id === "Books" || id === "Billing") ? "lexwear" : null, installedAt: 0, edition: null, seats: 0 };
  migrateBooks(s);
  s.tax = data.tax ? { ...base.tax, ...data.tax } : s.registration ? legacyTax(s) : base.tax;
  return s;
}

// Devices whose model left the game (tower servers) are gone with everything that points at them: cables, lease entries,
// technician jobs, addresses, cluster places, the workloads on them and the panel hosts inside those workloads.
function dropGone(gone: Set<string>, s: GameState): GameState {
  if (!gone.size) return s;
  const has = (id: string | null | undefined) => !!id && gone.has(id);
  s.cables = s.cables.filter((c) => !has(c.a.device) && !has(c.b.device));
  s.leases = s.leases.map((l) => ({ ...l, devices: l.devices.filter((id) => !has(id)) }));
  s.techOps = s.techOps.filter((o) => !has(o.deviceId));
  s.ops = { ...s.ops, seized: s.ops.seized.filter((x) => !has(x.device.id) && MODELS.some((m) => m.id === x.device.model)) };
  const vms = new Set(s.workloads.filter((w) => has(w.deviceId)).map((w) => w.id));
  s.workloads = s.workloads.filter((w) => !vms.has(w.id));
  for (const id of gone) for (const c of s.clusters.filter((x) => x.nodes.some((n) => n.deviceId === id))) leave(s, c.id, id);
  for (const c of s.clusters.filter((x) => x.vm && vms.has(x.vm))) dropCluster(s, c.id);
  s.workloads = s.workloads.filter((w) => !w.clusterId || s.clusters.some((c) => c.id === w.clusterId));
  const held = (id: string | null) => !id || gone.has(id) || vms.has(id) ? null : id;
  s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => ({ ...a, holder: held(a.holder) })) };
  return s;
}

// Saves from before routers stood in the rack: the basement router leaves the carrier panel for the lowest free unit of a
// basement rack (storage when none has room), and a line jack on the panel gets a cable to the router's DSL port.
function shelveRouter(s: GameState): void {
  const loc = s.locations.find((l) => !l.dc);
  if (!loc || s.devices.some((d) => d.model === "line-jack")) return;
  const jack = device(`dev${s.nextId++}`, "line-jack", "", null, 0, loc.id, `${loc.az}-line-01`, 0);
  s.devices = [...s.devices, jack];
  const gw = s.devices.find((d) => d.panel === loc.id && isOfficeRouter(modelById(d.model)));
  if (!gw) return;
  const rack = s.racks.find((r) => r.locationId === loc.id && r.arriveAt === null && freeSlots(s, r.id, 1).length);
  Object.assign(gw, rack ? { panel: null, rackId: rack.id, slot: freeSlots(s, rack.id, 1)[0] } : { panel: null, store: loc.id });
  if (rack) s.cables = [...s.cables, { id: `cab${s.nextId++}`, a: { device: jack.id, port: 0 }, b: { device: gw.id, port: wanPort(modelById(gw.model)) }, kind: "copper", color: null }];
}
