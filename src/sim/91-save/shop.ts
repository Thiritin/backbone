import type { GameState } from "../50-state";

// The order form was first a marketing channel, then the "handRolled" shop variant; both load as email orders only.
export function fillShop(s: GameState, saved: readonly string[] = []): void {
  if (saved.includes("orderForm")) s.marketing = { ...s.marketing, owned: s.marketing.owned.filter((c) => (c as string) !== "orderForm") };
  if ((s.shop.variant as string) !== "handRolled") return;
  s.shop = { ...s.shop, variant: null, modules: {} };
  s.marketing = { ...s.marketing, emailOrders: true };
}
