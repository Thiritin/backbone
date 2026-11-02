import type { ComponentType } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { dcProvider } from "../../../../../sim/20-world/datacenters";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { eraOf } from "../era";
import { Plain } from "./plain";
import { routeOf, type ProviderProps } from "./ProviderSite";

// A provider's design is the default export of providers/<id>.tsx; a provider without one gets the plain layout.
export interface Design { view: ComponentType<ProviderProps>; late: number }
const DESIGNS: Record<string, Design> = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: Design }>(["./*.tsx", "!./ProviderSite.tsx", "!./registry.tsx", "!./plain.tsx"], { eager: true }))
    .map(([path, m]) => [path.slice(2, -4), m.default]),
);
const PLAIN: Design = { view: Plain, late: 2015 };

export function ProviderSite({ game, id, path, go }: { game: GameState; id: string; path: string; go: (url: string) => void }) {
  const p = dcProvider(id), { view: View, late } = DESIGNS[id] ?? PLAIN, year = yearOf(game.hour);
  const look = eraOf([{ from: 2005, look: "early" }, { from: late, look: "late" }], year);
  return <View game={game} p={p} look={look} route={routeOf(id, path)} year={year} go={(to) => go(`${displayHost(p.host)}${to}`)} />;
}
