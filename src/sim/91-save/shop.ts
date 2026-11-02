import type { GameState } from "../50-state";
import { versionAt } from "../10-catalog/software-versions";
import { isLicensed, issueKey, SHOP_MACHINE, updateKey, yearAfter } from "../60-infra/licence";

// The order form was first a marketing channel, then the "handRolled" shop variant; both load as email orders only.
export function fillShop(s: GameState, saved: readonly string[] = []): void {
  if (saved.includes("orderForm")) s.marketing = { ...s.marketing, owned: s.marketing.owned.filter((c) => (c as string) !== "orderForm") };
  if ((s.shop.variant as string) !== "handRolled") return;
  s.shop = { ...s.shop, variant: null, modules: {} };
  s.marketing = { ...s.marketing, emailOrders: true };
}

// Saves from before installed shop systems: the shop goes onto the first panel host in the newest release of the save's
// month, holding a one-time key whose year of updates starts now. Without a panel host it waits to be installed.
export function installSavedShop(s: GameState): void {
  const id = s.shop.variant, c = s.clusters.find((x) => x.kind === "panel" && x.panel);
  if (!id || !c) return;
  const v = versionAt(id, s.hour);
  if (isLicensed(id)) {
    const k = issueKey(s, id, null, undefined, v.major);
    updateKey(s, k.id, { kind: "once", covers: { kind: "version", major: v.major }, renewsAt: null, updatesUntil: yearAfter(s.hour), machineId: SHOP_MACHINE });
  }
  s.shop = { ...s.shop, install: { clusterId: c.id, version: v.version, at: s.hour } };
}
