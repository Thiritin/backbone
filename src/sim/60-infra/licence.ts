// docs/design/plans/software-licences.md: licence keys, trials per machine and the status of every licensed install.
import { keyCode } from "../00-core/rng";
import { dateOf, hourOf, yearOf } from "../00-core/time";
import { tiersOf, topTier, type LicenceTier } from "../10-catalog/licence-tiers";
import { SOFTWARE } from "../10-catalog/platforms";
import { licensingAt, SERVER_OS } from "../10-catalog/server-os";
import { versionAt, versionInfo, versionsOf } from "../10-catalog/software-versions";
import type { GameState, Licence } from "../50-state";
import type { Cluster } from "./cluster";

// unlicensed: the assigned key is for an older major version than the one installed.
export type LicenceStatus = "trial" | "active" | "ended" | "lapsed" | "unlicensed";

const productOf = (id: string) => SERVER_OS.find((o) => o.id === id) ?? SOFTWARE.find((x) => x.id === id);
// Free software has no licence terms.
export const isLicensed = (product: string): boolean => productOf(product)?.trialDays !== undefined;
// Days of the product's trial; null when it needs a key at install.
export const trialDaysOf = (product: string): number | null => productOf(product)?.trialDays ?? null;
// A panel with editions starts on a trial of its top tier instead of a key at install; VMwhere editions are chosen later.
export const hasTrialTiers = (product: string): boolean => tiersOf(product).length > 0 && trialDaysOf(product) !== null && SOFTWARE.find((x) => x.id === product)?.kind === "panel";

export const assignedKey = (s: GameState, machineId: string, product: string): Licence | undefined =>
  s.licenses.find((k) => k.machineId === machineId && k.product === product);
export const unassignedKeys = (s: GameState, product: string): Licence[] => s.licenses.filter((k) => k.product === product && k.machineId === null);
export const trialOf = (s: GameState, machineId: string, product: string): GameState["trials"][number] | undefined =>
  s.trials.find((x) => x.machineId === machineId && x.product === product);

// The version the machine runs of an OS or software id, or null when it is not installed.
export function installedVersion(s: GameState, machineId: string, product: string): string | null {
  const m = [...s.devices, ...s.workloads].find((x) => x.id === machineId);
  return (m?.os?.id === product ? m.os.version : m?.software?.find((x) => x.id === product)?.version) ?? null;
}
const installedMajor = (s: GameState, machineId: string, product: string): string | undefined =>
  versionInfo(product, installedVersion(s, machineId, product) ?? "")?.major;
// A key for a major the product never had (a year, from before versions) covers whatever is installed.
const isNewer = (product: string, installed: string | null, major: string): boolean => {
  const vs = versionsOf(product), i = vs.findIndex((v) => v.version === installed), k = vs.findIndex((v) => v.major === major);
  return i >= 0 && k >= 0 && vs[i].major !== major && i > k;
};

// An assigned key makes an install active until it lapses, unless it is for an older major version; without one the install
// runs its trial or has ended. Null for free software.
export function licenceStatus(s: GameState, machineId: string, product: string): LicenceStatus | null {
  if (!isLicensed(product)) return null;
  const k = assignedKey(s, machineId, product);
  if (k?.covers.kind === "version" && isNewer(product, installedVersion(s, machineId, product), k.covers.major)) return "unlicensed";
  if (k) return k.lapsedAt === null ? "active" : "lapsed";
  const trial = trialOf(s, machineId, product);
  return trial && s.hour < trial.until ? "trial" : "ended";
}

const nextMonth = (hour: number): number => {
  const d = dateOf(hour);
  return hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
};

// The major a one-time key bought now covers: the one of the newest release out.
const majorAt = (product: string, hour: number): string => versionAt(product, hour).major;

// Adds an unassigned key; its code is seeded by its number, one per order line. A key bought without an order is its own order.
// A one-time key covers a major version, the release on sale unless major names one; any other key covers a monthly term.
export function issueKey(s: GameState, product: string, edition: string | null, orderId?: string, major?: string): Licence {
  const n = 1 + Math.max(0, ...s.licenses.map((k) => Number(k.id.slice(3))));
  const kind = tiersOf(product).find((x) => x.id === edition)?.kind ?? licensingAt(productOf(product)!, yearOf(s.hour)).kind;
  const term = kind === "once" ? null : nextMonth(s.hour);
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
// The monthly bill pays every assigned term key through the next month.
export function renewTerms(s: GameState): void {
  const until = nextMonth(s.hour);
  s.licenses = s.licenses.map((k) => (k.machineId !== null && k.covers.kind === "term" ? { ...k, covers: { kind: "term", until }, renewsAt: until } : k));
}
export const assignKey = (s: GameState, keyId: string, machineId: string): void => updateKey(s, keyId, { machineId });
export const releaseKey = (s: GameState, keyId: string): void => updateKey(s, keyId, { machineId: null });

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

// The edition on the panel's key; a trial or an ended trial runs the top tier.
export function tierOf(s: GameState, c: Cluster): LicenceTier | undefined {
  const edition = panelKey(s, c)?.edition;
  return tiersOf(c.panel).find((x) => x.id === edition) ?? topTier(c.panel);
}

// A trial that ran out or a licence that lapsed blocks new accounts.
export const licenceExpired = (s: GameState, c: Cluster): boolean => {
  const status = panelStatus(s, c);
  return status === "ended" || status === "lapsed";
};

// The error that refuses one more account on a panel host, or null.
export function licenceBlock(s: GameState, c: Cluster): string | null {
  const tier = tierOf(s, c);
  if (!tier) return null;
  if (licenceExpired(s, c)) return "error.licenceExpired";
  return tier.cap !== null && accountsOn(s, c) + 1 > tier.cap ? "error.licenceCap" : null;
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
    const { licence, ...rest } = c as Cluster & { licence?: LegacyPanel };
    const m = panelMachine(c), top = topTier(c.panel);
    if (!m || !c.panel || !top) return rest;
    const lic = licence ?? { tier: top.id, trialUntil: null, lapsedAt: null };
    if (lic.trialUntil !== null) s.trials = [...s.trials, { machineId: m, product: c.panel, until: lic.trialUntil }];
    else add(m, c.panel, { lapsedAt: lic.lapsedAt }, lic.tier);
    return rest;
  });
}
