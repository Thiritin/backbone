// Installing a shop system, buying its modules and arranging its server groups (docs/design/shop.md).
import { MODULE_IDS, shopById, SHOPS, type ShopId } from "../10-catalog/shops";
import { shopOnSale } from "../10-catalog/shop-licences";
import { nextMajor, versionAt } from "../10-catalog/software-versions";
import { assignedKey, assignKey, covers, installKeyBlock, issueKey, licenceBlock, licenseInstall, SHOP_MACHINE, updateKey, yearAfter } from "../60-infra/licence";
import { upgradeOffer } from "../80-business/vendor-shop";
import { shopBroken } from "../60-infra/shop-files";
import type { GameState } from "../50-state";
import { owns } from "../80-business/marketing";
import { groupKind, groupOf, hasModule, installable, newShop, shopUpdate, shopUpdatesFee, type Fill, type ServerGroup } from "../80-business/shop";
import { SERVES } from "../10-catalog/platforms";
import { t } from "../../i18n/en";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

function pay(s: GameState, amount: number, key: string, params: Record<string, string | number>): void {
  if (amount <= 0) return;
  s.cash = Math.round((s.cash - amount) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key, params, amount: -amount }];
}

// docs/design/plans/shop-software.md: why the shop system cannot go into a web space of the panel host, which counts against
// the panel's licence. version is the release whose files the installer runs, else the newest the key may install; a typed
// key licenses it, else it keeps the key it holds, runs its trial or needs a key.
export function shopClaimBlock(s: GameState, clusterId: string, id: ShopId, key?: string, version?: string): string | null {
  if (!SHOPS.some((x) => x.id === id)) return "error.unknownShop";
  if (!s.unlocks.includes("shops")) return "error.needsShopSkill";
  if (!owns(s, "website")) return "error.needsWebsite";
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return "error.unknownCluster";
  if (c.kind !== "panel" || !c.panel) return "error.shopHostPanel";
  if (s.shop.variant === id && s.shop.install?.clusterId === clusterId && !shopBroken(s)) return "error.shopInUse";
  const full = s.shop.install?.clusterId === clusterId ? null : licenceBlock(s, c);
  if (full) return full;
  const code = key?.trim().toUpperCase(), held = assignedKey(s, SHOP_MACHINE, id);
  const typed = code ? s.licenses.find((k) => k.product === id && k.key === code && (k.machineId === null || k.machineId === SHOP_MACHINE)) : undefined;
  if (!held && !typed && !shopOnSale(id, s.hour)) return "error.shopNotSold";
  const v = version ?? (installable(s, id, code ? typed : held) ?? versionAt(id, s.hour)).version;
  if (held && !code) return covers(held, v) ? null : "error.licenceKey";
  return installKeyBlock(s, SHOP_MACHINE, id, v, code);
}

// Puts the shop system into a web space of the panel host. Installing it on another host moves it; installing another
// system replaces it.
export function installShop(s: GameState, clusterId: string, id: ShopId, key?: string, version?: string): ActionResult {
  const blocked = shopClaimBlock(s, clusterId, id, key, version);
  if (blocked) return fail(blocked);
  const code = key?.trim().toUpperCase(), held = assignedKey(s, SHOP_MACHINE, id);
  const typed = code ? s.licenses.find((k) => k.product === id && k.key === code) : undefined;
  const v = version ?? (installable(s, id, code ? typed : held) ?? versionAt(id, s.hour)).version;
  if (s.shop.variant !== id) {
    // Modules belong to the system they were bought for: the old one's stay with it, the new one starts with its own.
    const was = s.shop.variant, modulesBy = { ...s.shop.modulesBy, ...(was && { [was]: { modules: s.shop.modules, licences: s.modules } }) };
    const back = modulesBy[id];
    s.shop = { ...newShop(), variant: id, since: s.hour, groups: s.shop.groups.length ? s.shop.groups : firstGroups(s), products: s.shop.products, productGroups: s.shop.productGroups, modulesBy, modules: back?.modules ?? {}, setupDone: false };
    s.modules = back?.licences ?? [];
  }
  s.shop = { ...s.shop, install: { clusterId, version: v, at: s.hour } };
  if (!held || code) licenseInstall(s, SHOP_MACHINE, id, v, code);
  return { ok: true, id: v };
}

const setVersion = (s: GameState, version: string) => { s.shop = { ...s.shop, install: { ...s.shop.install!, version } }; };

// Installs the newest release the shop's key may install.
export function updateShop(s: GameState): ActionResult {
  if (!s.shop.install) return fail("error.shopNotInstalled");
  const next = shopUpdate(s);
  if (!next) return fail("error.noUpdate");
  setVersion(s, next.version);
  return { ok: true, id: next.version };
}

// Pays the yearly updates fee of the shop's one-time key: its updates run a year past their end, or from now once ended.
// A vendor no longer selling keys charges the fee of the era the key was bought in.
export function renewShopUpdates(s: GameState): ActionResult {
  const id = s.shop.variant, k = id ? assignedKey(s, SHOP_MACHINE, id) : undefined;
  if (!id || !k || k.updatesUntil === undefined) return fail("error.noUpdates");
  const fee = shopUpdatesFee(s, k);
  if (fee === undefined) return fail("error.notForSale");
  if (s.cash < fee) return fail("error.noCash");
  payLicence(s, fee, "ledger.shopUpdates", { name: shopById(id).name });
  updateKey(s, k.id, { updatesUntil: yearAfter(Math.max(k.updatesUntil, s.hour)) });
  return { ok: true, id: k.id };
}

// Moves the shop to the newest release of the next major. A key for an older major is replaced by a key for the new one at
// the vendor's upgrade price; the old key goes back unassigned.
export function upgradeShop(s: GameState): ActionResult {
  const id = s.shop.variant, at = s.shop.install;
  if (!id || !at) return fail("error.shopNotInstalled");
  const next = nextMajor(id, at.version, s.hour);
  if (!next) return fail("error.noMajorUpgrade");
  const k = assignedKey(s, SHOP_MACHINE, id);
  if (k && !covers(k, next.version)) {
    const offer = k.covers.kind === "version" ? upgradeOffer(s, id, k.covers.major) : null;
    if (!offer) return fail("error.notForSale");
    if (s.cash < offer.fee) return fail("error.noCash");
    payLicence(s, offer.fee, "ledger.shopUpgrade", { name: shopById(id).name, major: next.major });
    assignKey(s, issueKey(s, id, null, undefined, next.major).id, SHOP_MACHINE);
  }
  setVersion(s, next.version);
  return { ok: true, id: next.version };
}

function payLicence(s: GameState, amount: number, key: string, params: Record<string, string | number>): void {
  if (amount <= 0) return;
  s.cash = Math.round((s.cash - amount) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key, params, amount: -amount }];
}

export function buyModule(s: GameState, module: string): ActionResult {
  if (!MODULE_IDS.includes(module)) return fail("error.unknownModule");
  if (hasModule(s, module) || s.shop.modules[module] !== undefined) return fail("error.moduleOwned");
  const v = s.shop.variant && shopById(s.shop.variant);
  if (!v) return fail("error.needsShop");
  if (v.extra === null || v.lacks?.includes(module)) return fail("error.moduleNotSold");
  const price = v.extra;
  if (price > 0 && s.cash < price) return fail("error.noCash");
  pay(s, price, "ledger.shopModule", { module });
  s.shop = { ...s.shop, modules: { ...s.shop.modules, [module]: s.hour + (v.extraHours ?? 0) } };
  return { ok: true, id: module };
}

// A first shop gets one group per kind of software the company runs, every installation active.
function firstGroups(s: GameState): ServerGroup[] {
  const kinds = [...new Set(s.clusters.map((c) => c.kind))].filter((k) => SERVES[k].length);
  return kinds.map((kind) => ({ id: `grp${s.nextId++}`, name: t(`group.${kind}`), members: s.clusters.filter((c) => c.kind === kind).map((c) => c.id), inactive: [], fill: "spread" }));
}

const editGroup = (s: GameState, id: string, f: (g: ServerGroup) => Partial<ServerGroup>): ActionResult => {
  const g = s.shop.groups.find((x) => x.id === id);
  if (!g) return fail("error.unknownGroup");
  s.shop = { ...s.shop, groups: s.shop.groups.map((x) => (x.id === id ? { ...x, ...f(x) } : x)) };
  return { ok: true, id };
};

export function createGroup(s: GameState, name: string): ActionResult {
  if (!s.shop.variant) return fail("error.needsShop");
  if (!name.trim()) return fail("error.groupName");
  const id = `grp${s.nextId++}`;
  s.shop = { ...s.shop, groups: [...s.shop.groups, { id, name: name.trim(), members: [], inactive: [], fill: "spread" }] };
  return { ok: true, id };
}

export function deleteGroup(s: GameState, id: string): ActionResult {
  if (!s.shop.groups.some((g) => g.id === id)) return fail("error.unknownGroup");
  s.shop = { ...s.shop, groups: s.shop.groups.filter((g) => g.id !== id), products: s.shop.products.map((p) => (p.serverGroupId === id ? { ...p, serverGroupId: null } : p)) };
  return { ok: true };
}

// Adds a software installation (a panel host, a whole hypervisor cluster) of the group's kind, active, at the end.
export function addToGroup(s: GameState, id: string, clusterId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), g = s.shop.groups.find((x) => x.id === id);
  if (!c) return fail("error.unknownCluster");
  if (!SERVES[c.kind].length || (g && groupKind(s, g) && c.kind !== groupKind(s, g))) return fail("error.groupKind");
  if (groupOf(s, clusterId)) return fail("error.inGroup");
  return editGroup(s, id, (x) => ({ members: [...x.members, clusterId] }));
}

export const removeFromGroup = (s: GameState, id: string, clusterId: string): ActionResult =>
  editGroup(s, id, (x) => ({ members: x.members.filter((m) => m !== clusterId), inactive: x.inactive.filter((m) => m !== clusterId) }));

// Off: new shop orders are not placed on the installation; its services keep running.
export const setMemberActive = (s: GameState, id: string, clusterId: string, on: boolean): ActionResult =>
  editGroup(s, id, (x) => ({ inactive: on ? x.inactive.filter((m) => m !== clusterId) : [...new Set([...x.inactive, clusterId])] }));

export const setGroupFill = (s: GameState, id: string, fill: Fill): ActionResult => editGroup(s, id, () => ({ fill }));

// Moves a member one place up (-1) or down (1) in the fill order.
export function moveMember(s: GameState, id: string, clusterId: string, by: -1 | 1): ActionResult {
  const g = s.shop.groups.find((x) => x.id === id), i = g?.members.indexOf(clusterId) ?? -1, j = i + by;
  if (!g || i < 0) return fail("error.unknownGroup");
  if (j < 0 || j >= g.members.length) return { ok: true, id };
  const members = [...g.members];
  [members[i], members[j]] = [members[j], members[i]];
  return editGroup(s, id, () => ({ members }));
}
