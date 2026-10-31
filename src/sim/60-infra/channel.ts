import { hashRng, rand } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import { idNum } from "../10-catalog/usage";
import type { GameState } from "../50-state";
import type { Cluster } from "./cluster";

export type Channel = "stable" | "release" | "edge";
export const CHANNELS: Channel[] = ["stable", "release", "edge"];

// economy.md, Security advisories, Updating: a channel takes a year's release from this month on (January is 0); before it, the previous year's.
const FROM_MONTH: Record<Channel, number> = { edge: 0, release: 3, stable: 6 };
export const BREAK_CHANCE: Record<Channel, number> = { stable: 0.01, release: 0.04, edge: 0.12 };
export const BREAK_HOURS: Record<Channel, number> = { stable: 3, release: 3, edge: 6 };
export const EDGE_HOWTO = 0.97;

// Clusters from before channels run the Release channel.
export const channelOf = (c: Pick<Cluster, "channel">): Channel => c.channel ?? "release";

export function targetYear(channel: Channel, hour: number): number {
  const d = dateOf(hour);
  return d.getUTCMonth() >= FROM_MONTH[channel] ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

// Whether updating the cluster now breaks it; the same answer all hour, so the tick and the screen agree.
export const updateBreaks = (s: GameState, c: Cluster): boolean =>
  rand(hashRng(s.seed, s.hour, idNum(c.id), 71)) < BREAK_CHANCE[channelOf(c)];

// The release year the cluster's features come from: a feature of year Y reaches Edge in January, Release in April and Stable in July.
export const featureYear = (_s: GameState, c: Cluster): number => c.version;
