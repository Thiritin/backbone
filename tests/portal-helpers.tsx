import { renderToString } from "react-dom/server";
import { expect } from "vitest";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import type { GameState } from "../src/sim/50-state";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop } from "../src/sim/90-actions/shop";
import { setLine } from "../src/sim/90-actions/website";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { readyGame, skipTo } from "./fixtures";

export const shopGame = (variant = "whmCache", year = 2005): GameState => {
  const s = readyGame(4);
  skipTo(s, year);
  s.cash = 1e6;
  setUpChannel(s, "website");
  chooseShop(s, "handRolled");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, variant as never).ok || variant === "handRolled").toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  setLine(s, "webHosting", true);
  return s;
};
export const idOf = (r: { ok: boolean; id?: string }) => { expect(r.ok).toBe(true); return r.id!; };
export const render = (s: GameState, variant: string, area: "store" | "configure" | "cart" | "client", ids: { group?: string; product?: string } = {}, screen?: string | Record<string, string>, part: "Store" | "Client" = "Store") => {
  const route = parsePortal(variant as never, portalPath(variant as never, area, ids, screen)) ?? { area, query: new URLSearchParams() };
  const Skin = skinOf(variant as never)[part];
  return renderToString(<Skin game={s} variant={variant as never} route={route} open={() => {}} />);
};

