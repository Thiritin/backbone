import type { GameState } from "../50-state";

// The order form used to be a marketing channel with upkeep; it is now the hand-rolled shop variant, bought once.
export function fillShop(s: GameState, saved: readonly string[] = []): void {
  if (!saved.includes("orderForm")) return;
  s.marketing = { ...s.marketing, owned: s.marketing.owned.filter((c) => (c as string) !== "orderForm") };
  if (s.shop.variant === null) s.shop = { ...s.shop, variant: "handRolled", since: 0, readyAt: 0 };
}
