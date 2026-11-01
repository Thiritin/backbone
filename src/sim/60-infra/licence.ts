// docs/design/plans/software-licences.md: licence keys, trials per machine and the status of every licensed install.
import { keyCode } from "../00-core/rng";
import { dateOf, hourOf } from "../00-core/time";
import { tiersOf, topTier, type LicenceTier } from "../10-catalog/licence-tiers";
import { SOFTWARE } from "../10-catalog/platforms";
import { eraAt, SERVER_OS } from "../10-catalog/server-os";
import { UI_LOOKS, versionAt, versionInfo, versionsOf } from "../10-catalog/software-versions";
import type { GameState, Licence } from "../50-state";
import type { Cluster } from "./cluster";

// unlicensed: the assigned key is for an older major version than the one installed.
export type LicenceStatus = "trial" | "active" | "ended" | "lapsed" | "unlicensed";

export const productOf = (id: string) => SERVER_OS.find((o) => o.id === id) ?? SOFTWARE.find((x) => x.id === id);
export const nameOf = (product: string): string => productOf(product)?.name ?? product;
// Free software has no licence terms.
export const isLicensed = (product: string): boolean => productOf(product)?.trialDays !== undefined;
// Days of the product's trial; null when it needs a key at install.
export const trialDaysOf = (product: string): number | null => productOf(product)?.trialDays ?? null;
// The editions a licence key can carry; VMwhere editions belong to its cluster instead.
export const keyTiers = (product: string): LicenceTier[] => (SOFTWARE.find((x) => x.id === product)?.kind === "panel" ? tiersOf(product) : []);
// A panel with editions starts on a trial of its top tier instead of a key at install.
export const hasTrialTiers = (product: string): boolean => keyTiers(product).length > 0 && trialDaysOf(product) !== null;

export const assignedKey = (s: GameState, machineId: string, product: string): Licence | undefined =>
  s.licenses.find((k) => k.machineId === machineId && k.product === product);
export const unassignedKeys = (s: GameState, product: string): Licence[] => s.licenses.filter((k) => k.product === product && k.machineId === null);
export const trialOf = (s: GameState, machineId: string, product: string): GameState["trials"][number] | undefined =>
  s.trials.find((x) => x.machineId === machineId && x.product === product);

// The version the machine runs of an OS or software id, or null when it is not installed. Software runs the version it
// upgrades from until the upgrade is done.
export function installedVersion(s: GameState, machineId: string, product: string): string | null {
  const m = s.devices.find((x) => x.id === machineId) ?? s.workloads.find((x) => x.id === machineId);
  if (m?.os?.id === product) return m.os.version;
  const x = m?.software?.find((y) => y.id === product);
  return (x?.from && x.doneAt !== null && x.doneAt > s.hour ? x.from : x?.version) ?? null;
}
// The console look id of the version the machine runs, or null when the version or its UI generations are unknown.
export function lookOf(s: GameState, machineId: string, product: string): string | null {
  const vs = versionsOf(product), at = (v: string | null) => vs.findIndex((x) => x.version === v);
  const i = at(installedVersion(s, machineId, product));
  return i < 0 ? null : UI_LOOKS[product]?.filter(([from]) => at(from) <= i).at(-1)?.[1] ?? null;
}
const installedMajor =(s: GameState, machineId: string, product: string): string | undefined =>
  versionInfo(product, installedVersion(s, machineId, product) ?? "")?.major;
// A key for a major the product never had (a year, from before versions) covers whatever is installed.
const isNewer = (product: string, installed: string | null, major: string): boolean => {
  const vs = versionsOf(product), i = vs.findIndex((v) => v.version === installed), k = vs.findIndex((v) => v.major === major);
  return i >= 0 && k >= 0 && vs[i].major !== major && i > k;
};

// An assigned key makes an install active until it lapses, unless it is for an older major version; without one the install
// runs its trial or has ended. Null for free software.
// A lapsed key, or a cancelled term key past the term it paid for.
export const keyExpired = (s: GameState, k: Licence): boolean =>
  k.lapsedAt !== null || (k.covers.kind === "term" && k.renewsAt === null && s.hour >= k.covers.until);

export function licenceStatus(s: GameState, machineId: string, product: string): LicenceStatus | null {
  if (!isLicensed(product)) return null;
  const k = assignedKey(s, machineId, product);
  if (k?.covers.kind === "version" && isNewer(product, installedVersion(s, machineId, product), k.covers.major)) return "unlicensed";
  if (k) return keyExpired(s, k) ? "lapsed" : "active";
  const trial = trialOf(s, machineId, product);
  return trial && s.hour < trial.until ? "trial" : "ended";
}

// The same day and hour n months later, or the last day of a shorter month.
const monthsAfter = (hour: number, n: number): number => {
  const d = dateOf(hour), y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  return hourOf(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate()), d.getUTCHours())));
};
export const monthAfter = (hour: number): number => monthsAfter(hour, 1);
export const yearAfter = (hour: number): number => monthsAfter(hour, 12);

// The key editions the vendor sells at the hour.
export const tiersOnSale = (product: string | null, hour: number): LicenceTier[] => {
  const editions = product && productOf(product) ? eraAt(productOf(product)!, hour).editions : undefined;
  return product ? keyTiers(product).filter((x) => !editions || editions.includes(x.id)) : [];
};
// Whether a key without an edition of its own renews yearly under the vendor's terms at the hour.
export const yearly = (product: string, edition: string | null, hour: number): boolean =>
  !keyTiers(product).some((x) => x.id === edition) && !!productOf(product) && eraAt(productOf(product)!, hour).period === "year";
const termAfter = (product: string, edition: string | null, hour: number, from: number): number =>
  yearly(product, edition, hour) ? yearAfter(from) : monthAfter(from);

// The major a one-time key bought now covers: the one of the newest release out.
const majorAt = (product: string, hour: number): string => versionAt(product, hour).major;

// Adds an unassigned key; its code is seeded by its number, one per order line. A key bought without an order is its own order.
// A one-time key covers a major version, the release on sale unless major names one; any other key covers a month, or a year in a yearly era, from today.
export function issueKey(s: GameState, product: string, edition: string | null, orderId?: string, major?: string): Licence {
  const n = 1 + Math.max(0, ...s.licenses.map((k) => Number(k.id.slice(3))));
  const kind = keyTiers(product).find((x) => x.id === edition)?.kind ?? eraAt(productOf(product)!, s.hour).kind;
  const term = kind === "once" ? null : termAfter(product, edition, s.hour, s.hour);
  const k: Licence = {
    id: `lic${n}`, product, edition, kind, key: keyCode(s.seed, n, 611), orderId: orderId ?? `ord${n}`, boughtAt: s.hour, machineId: null,
    covers: term === null ? { kind: "version", major: major ?? majorAt(product, s.hour) } : { kind: "term", until: term }, renewsAt: term, lapsedAt: null,
  };
  s.licenses = [...s.licenses, k];
  return k;
}

export const updateKey = (s: GameState, keyId: string, patch: Partial<Licence>): void => {
  s.licenses = s.licenses.map((k) => (k.id === keyId ? { ...k, ...patch } : k));
};
// Pays a subscription key through its term from the given hour.
export const extendKey = (s: GameState, keyId: string, from: number): void => {
  const k = s.licenses.find((x) => x.id === keyId)!, until = termAfter(k.product, k.edition, s.hour, from);
  updateKey(s, keyId, { covers: { kind: "term", until }, renewsAt: until, lapsedAt: null });
};
// A machine holds one key per product: the one it held before goes back unassigned.
export function assignKey(s: GameState, keyId: string, machineId: string): void {
  const product = s.licenses.find((k) => k.id === keyId)?.product;
  s.licenses = s.licenses.map((k) => (k.id === keyId ? { ...k, machineId } : k.machineId === machineId && k.product === product ? { ...k, machineId: null } : k));
}
export const releaseKey = (s: GameState, keyId: string): void => updateKey(s, keyId, { machineId: null });

// Whether the key may license that version of its product: a one-time key covers its major and the ones before.
const covers = (k: Licence, version: string): boolean => !(k.covers.kind === "version" && isNewer(k.product, version, k.covers.major));
// The key of the product with that code, as typed, that covers the version: unassigned, or held by the machine already.
export const keyFor = (s: GameState, machineId: string, product: string, code: string, version: string): Licence | undefined =>
  s.licenses.find((k) => k.product === product && (k.machineId === null || k.machineId === machineId) && k.key === code.trim().toUpperCase() && covers(k, version));

// Why an install of the product cannot start: a typed key that does not fit, or no key for a product without a trial.
export function installKeyBlock(s: GameState, machineId: string, product: string, version: string, code?: string): string | null {
  if (!isLicensed(product)) return null;
  if (code) return keyFor(s, machineId, product, code, version) ? null : "error.licenceKey";
  return trialDaysOf(product) === null ? "error.licenceKey" : null;
}

// Why an in-place upgrade to the version cannot start: a typed key that does not cover it, or none typed while the machine's
// key is for an older major.
export function upgradeKeyBlock(s: GameState, machineId: string, product: string, version: string, code?: string): string | null {
  if (!isLicensed(product)) return null;
  if (code) return keyFor(s, machineId, product, code, version) ? null : "error.licenceKey";
  const k = assignedKey(s, machineId, product);
  return k && !covers(k, version) ? "error.licenceKey" : null;
}
// A key typed for an upgrade replaces the one the machine held, which goes back unassigned.
export function upgradeKey(s: GameState, machineId: string, product: string, version: string, code?: string): void {
  const k = code ? keyFor(s, machineId, product, code, version) : undefined;
  if (k) assignKey(s, k.id, machineId);
}

// Licenses a started install with the typed key, or starts its trial.
export function licenseInstall(s: GameState, machineId: string, product: string, version: string, code?: string): void {
  const k = code ? keyFor(s, machineId, product, code, version) : undefined;
  if (k) assignKey(s, k.id, machineId);
  else startTrial(s, machineId, product);
}

// The keys a build takes, one per product in My account order, null where the product runs its trial or is free. A string
// names the first product short of a key.
export function buildKeys(s: GameState, items: { product: string; version: string }[]): (Licence | null)[] | string {
  const taken = new Set<string>(), out: (Licence | null)[] = [];
  for (const { product, version } of items) {
    const k = isLicensed(product) ? unassignedKeys(s, product).find((x) => !taken.has(x.id) && covers(x, version)) : undefined;
    if (!k && isLicensed(product) && trialDaysOf(product) === null) return product;
    if (k) taken.add(k.id);
    out.push(k ?? null);
  }
  return out;
}
export const licenseBuild = (s: GameState, machineId: string, items: { product: string }[], keys: (Licence | null)[]): void =>
  items.forEach((x, i) => { const k = keys[i]; if (k) assignKey(s, k.id, machineId); else startTrial(s, machineId, x.product); });

// Erased disks hand back every key the machine held.
export function releaseMachine(s: GameState, machineId: string): void {
  s.licenses = s.licenses.map((k) => (k.machineId === machineId ? { ...k, machineId: null } : k));
  releaseGone(s);
}
// Keys go back unassigned once their machine no longer holds the product.
export function releaseGone(s: GameState): void {
  s.licenses = s.licenses.map((k) => (k.machineId !== null && installedVersion(s, k.machineId, k.product) === null ? { ...k, machineId: null } : k));
}

// Starts the product's trial on the machine unless it has none or already ran there.
export function startTrial(s: GameState, machineId: string, product: string): void {
  const days = productOf(product)?.trialDays;
  if (days == null || trialOf(s, machineId, product)) return;
  s.trials = [...s.trials, { machineId, product, until: s.hour + days * 24 }];
}

export const accountsOn = (s: GameState, c: Cluster): number => s.workloads.filter((w) => w.clusterId === c.id).length;

// The machine a panel host runs on: its VM or its one server.
export const panelMachine = (c: Cluster): string | null => c.vm ?? c.nodes[0]?.deviceId ?? null;
export const panelKey = (s: GameState, c: Cluster): Licence | undefined => {
  const m = panelMachine(c);
  return m && c.panel ? assignedKey(s, m, c.panel) : undefined;
};
export const panelStatus = (s: GameState, c: Cluster): LicenceStatus | null => {
  const m = panelMachine(c);
  return m && c.panel ? licenceStatus(s, m, c.panel) : null;
};

// The edition on the panel's key; a trial or an ended trial runs the top tier on sale.
export function tierOf(s: GameState, c: Cluster): LicenceTier | undefined {
  const edition = panelKey(s, c)?.edition;
  return tiersOf(c.panel).find((x) => x.id === edition) ?? tiersOnSale(c.panel, s.hour).at(-1) ?? topTier(c.panel);
}

// A trial that ran out, a licence that lapsed or a key for an older major on any machine of the cluster stops its software's
// gated work: new accounts, VMs and services, updates and backups to it.
export const licenceExpired = (s: GameState, c: Cluster): boolean => {
  const id = c.panel ?? c.platform;
  return !!id && isLicensed(id) && (c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId)).some((m) => ["ended", "lapsed", "unlicensed"].includes(licenceStatus(s, m, id) ?? ""));
};

// The error that refuses one more account, VM or service on the cluster, or null.
export function licenceBlock(s: GameState, c: Cluster): string | null {
  if (licenceExpired(s, c)) return "error.licenceExpired";
  const tier = tierOf(s, c);
  return tier && tier.cap !== null && accountsOn(s, c) + 1 > tier.cap ? "error.licenceCap" : null;
}

// Saves from before licence keys: every one-time licence a machine held and every licensed install get an assigned key, and a
// panel's trial, edition and lapse move from its cluster to the trial list and its key.
type LegacyPanel = { tier: string; trialUntil: number | null; lapsedAt: number | null };
export function legacyLicences(s: GameState, held: { id: string; machineId: string; boughtAt: number }[]): void {
  s.licenses = [];
  s.trials = [];
  const add = (machineId: string, product: string, patch: Partial<Licence> = {}, edition: string | null = null, major?: string) => {
    if (!assignedKey(s, machineId, product)) updateKey(s, issueKey(s, product, edition, undefined, major).id, { machineId, ...patch });
  };
  for (const l of held) {
    const major = installedMajor(s, l.machineId, l.id) ?? majorAt(l.id, l.boughtAt);
    add(l.machineId, l.id, { kind: "once", boughtAt: l.boughtAt, covers: { kind: "version", major }, renewsAt: null });
  }
  for (const m of [...s.devices, ...s.workloads]) {
    for (const id of [m.os?.id, ...(m.software ?? []).map((x) => x.id)]) if (id && isLicensed(id) && !hasTrialTiers(id)) add(m.id, id, {}, null, installedMajor(s, m.id, id));
  }
  s.clusters = s.clusters.map((c) => {
    if (!c.panel) return c;
    const { licence, ...rest } = c as Cluster & { licence?: LegacyPanel };
    const m = panelMachine(c), top = topTier(c.panel);
    if (!m || !top) return rest;
    const lic = licence ?? { tier: top.id, trialUntil: null, lapsedAt: null };
    if (lic.trialUntil !== null) s.trials = [...s.trials, { machineId: m, product: c.panel, until: lic.trialUntil }];
    else add(m, c.panel, { lapsedAt: lic.lapsedAt }, lic.tier);
    return rest;
  });
}
