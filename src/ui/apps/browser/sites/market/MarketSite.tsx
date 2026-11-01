import type { ComponentType } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { CHANNELS, type Channel } from "../../../../../sim/10-catalog/used";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { Ebuy } from "./ebuy";
import { Craigslost } from "./craigslost";
import { WebHostingTalc } from "./webhostingtalc";
import type { MarketProps } from "./shared";

const SITES: Record<Channel, ComponentType<MarketProps>> = { ebuy: Ebuy, board: WebHostingTalc, chat: Craigslost };

// A used market's site; each picks its own look by year.
export function MarketSite({ game, channel, path, go }: { game: GameState; channel: Channel; path: string; go: (url: string) => void }) {
  const View = SITES[channel], host = displayHost(CHANNELS.find((c) => c.id === channel)!.host);
  return <View game={game} path={path} year={yearOf(game.hour)} go={(to) => go(`${host}${to}`)} />;
}
