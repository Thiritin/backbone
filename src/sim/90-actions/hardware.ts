import type { BondMode, End, GameState } from "../50-state";

// error is an i18n key.
export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export function rentRack(_s: GameState, _city: string): ActionResult { throw new Error("todo"); }
export function buyDevice(_s: GameState, _modelId: string, _rackId: string, _slot: number, _brand?: string): ActionResult { throw new Error("todo"); }
export function removeDevice(_s: GameState, _deviceId: string): ActionResult { throw new Error("todo"); }
export function connect(_s: GameState, _a: End, _b: End): ActionResult { throw new Error("todo"); }
export function disconnect(_s: GameState, _cableId: string): ActionResult { throw new Error("todo"); }
export function setBond(_s: GameState, _deviceId: string, _mode: BondMode): ActionResult { throw new Error("todo"); }
// An empty list removes the group that contains any of the ports.
export function setPortGroup(_s: GameState, _switchId: string, _ports: number[]): ActionResult { throw new Error("todo"); }
