import { describe, expect, it } from "vitest";
import { serviceOnline } from "../src/sim/40-support/status";
import { type GameState } from "../src/sim/50-state";
import { linkStatus, readOnlySweep } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { BASEMENT_SERVER, readyGame } from "./fixtures";

const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const online = (s: GameState) => s.services.map((v) => serviceOnline(s, v.id));

describe("read-only status sweep", () => {
  it("gives the same service status as checking one by one, with the server up and down", () => {
    const s = readyGame(7);
    runTo(s, s.hour + 24 * 60);
    expect(s.services.length).toBeGreaterThan(0);
    expect(readOnlySweep(s, () => online(s))).toEqual(online(s));
    s.devices.find((d) => d.id === BASEMENT_SERVER)!.on = false;
    expect(readOnlySweep(s, () => online(s))).toEqual(online(s));
  });

  it("forgets its results once the sweep ends", () => {
    const s = readyGame(7);
    const d = s.devices.find((x) => x.id === BASEMENT_SERVER)!;
    expect(readOnlySweep(s, () => linkStatus(s, d.id).online)).toBe(true);
    d.on = false;
    expect(linkStatus(s, d.id).online).toBe(false);
  });
});
