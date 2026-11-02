import { describe, expect, it } from "vitest";
import { createRng } from "../src/sim/00-core/rng";
import type { SimEvent } from "../src/sim/88-tick/tick";
import type { GameState } from "../src/sim/50-state";
import { apt } from "../src/sim/60-infra/apt";
import { gridOutage, upsMinutes } from "../src/sim/60-infra/incidents";
import { addressOf } from "../src/sim/60-infra/lan";
import { linkStatus, pluggedIn, psusOf } from "../src/sim/60-infra/status";
import { shutdownBy } from "../src/sim/60-infra/ups";
import { resolve } from "../src/sim/80-business/browser";
import { setPlugged, setUpsAgent } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, buyDevice, readyGame, withNetwork } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const server = (s: GameState) => s.devices.find((d) => d.id === BASEMENT_SERVER)!;

// A UPS racked in the basement, plugged in.
function ups(s: GameState, model: string): string {
  s.cash = 100_000;
  const id = ok(buyDevice(s, model, "Eatin", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", 20));
  return id;
}

describe("UPS power cords", () => {
  it("a UPS plugs in and out and carries the location only while plugged", () => {
    const s = readyGame(1), id = ups(s, "ups-1500");
    const d = s.devices.find((x) => x.id === id)!;
    expect(pluggedIn(d)).toBe(true);
    expect(upsMinutes(s, "loc1")).toBeGreaterThan(0);
    ok(setPlugged(s, id, psusOf(d)[0].id, false));
    expect(pluggedIn(d)).toBe(false);
    expect(upsMinutes(s, "loc1")).toBe(0);
    ok(setPlugged(s, id, psusOf(d)[0].id, true));
    expect(upsMinutes(s, "loc1")).toBeGreaterThan(0);
  });

  it("a UPS from an old save gets a power supply that is plugged in", () => {
    const s = readyGame(1), id = ups(s, "ups-1500");
    const raw = JSON.parse(serialize(s));
    raw.devices.find((d: { id: string }) => d.id === id).components = [];
    const d = deserialize(JSON.stringify(raw)).devices.find((x) => x.id === id)!;
    expect(psusOf(d)).toHaveLength(1);
    expect(pluggedIn(d)).toBe(true);
  });
});

describe("managed UPS", () => {
  it("takes an address and answers with its web interface", () => {
    const s = readyGame(1), id = ups(s, "ups-1500-net");
    withNetwork(s, id);
    expect(linkStatus(s, id).online).toBe(true);
    const ip = addressOf(s, id)!;
    expect(ip).toBeTruthy();
    expect(resolve(s, `http://${ip}/`).page).toEqual({ kind: "ups", deviceId: id });
  });

  it("a server without the agent loses power, one with it shuts down cleanly", () => {
    const run = (agent: boolean) => {
      const s = readyGame(1), id = ups(s, "ups-1500-net");
      withNetwork(s, id);
      if (agent) ok(setUpsAgent(s, BASEMENT_SERVER, true));
      gridOutage(s, s.locations[0], 600, createRng(1), [] as SimEvent[]);
      return server(s).log.map((e) => e.key);
    };
    expect(run(false)).toContain("ipmi.log.pulled");
    expect(run(true)).toContain("ipmi.log.upsShutdown");
    expect(run(true)).not.toContain("ipmi.log.pulled");
  });

  it("a plain UPS sends no signal", () => {
    const s = readyGame(1);
    ups(s, "ups-1500");
    ok(setUpsAgent(s, BASEMENT_SERVER, true));
    gridOutage(s, s.locations[0], 600, createRng(1), []);
    expect(server(s).log.map((e) => e.key)).toContain("ipmi.log.pulled");
  });

  it("VMwhere and HyperVee hosts shut down through the hypervisor API, Proxmocks needs the agent", () => {
    const s = readyGame(1), c = s.clusters.find((x) => x.nodes.some((n) => n.deviceId === BASEMENT_SERVER))!;
    expect(shutdownBy(s, server(s))).toBeNull();
    c.platform = "vmwhere";
    expect(shutdownBy(s, server(s))).toBe("hypervisor");
    c.platform = "proxmocks";
    server(s).upsAgent = true;
    expect(shutdownBy(s, server(s))).toBe("agent");
  });

  it("the agent installs from the shell as nuts-client", () => {
    const s = readyGame(1);
    expect(apt(s, BASEMENT_SERVER, ["install", "nuts-client"], true).confirm).toBe(true);
    const r = apt(s, BASEMENT_SERVER, ["install", "-y", "nuts-client"], true);
    expect(r.action).toEqual([setUpsAgent, BASEMENT_SERVER, true]);
    server(s).upsAgent = true;
    expect(apt(s, BASEMENT_SERVER, ["remove", "nuts-client"], true).action).toEqual([setUpsAgent, BASEMENT_SERVER, false]);
  });
});
