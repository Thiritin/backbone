import type { End, GameState } from "../50-state";

export interface LinkStatus { online: boolean; gbit: number; warning: "bondNotGrouped" | null }

// The peer of every port on a device, or null for a free port.
export function portPeers(_s: GameState, _deviceId: string): (End | null)[] { throw new Error("todo"); }
// A device is online when a cable path through powered switches reaches a gateway.
export function linkStatus(_s: GameState, _deviceId: string): LinkStatus { throw new Error("todo"); }
// Every slot where a device of this height fits, lowest first.
export function freeSlots(_s: GameState, _rackId: string, _height: number): number[] { throw new Error("todo"); }
