import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { device, type GameState } from "../src/sim/50-state";
import { bootFromUsb, installOs } from "../src/sim/90-actions/console";
import { readyGame, withNetwork, withStick } from "./fixtures";

const err = (r: object) => (r as { error?: string }).error;
const atInstaller = (s: GameState): string => {
  s.devices.push({ ...device("dev90", "g1-storage", "Dwell", "rack2", 10, null, "st-dev90", modelById("g1-storage").price), hostname: "node090" });
  withStick(s, "dev90", "lunix");
  withNetwork(s, "dev90");
  expect(bootFromUsb(s, "dev90").ok).toBe(true);
  return "dev90";
};

describe("installer hostname", () => {
  it("keeps the generated hostname when none is given", () => {
    const s = readyGame(7), id = atInstaller(s);
    expect(installOs(s, id, "lunix").ok).toBe(true);
    expect(s.devices.find((d) => d.id === id)!.hostname).toBe("node090");
  });

  it("takes a typed hostname and refuses bad or taken ones", () => {
    const s = readyGame(7), id = atInstaller(s);
    const other = s.devices.find((d) => d.id !== id && d.hostname)!.hostname!;
    expect(err(installOs(s, id, "lunix", undefined, undefined, undefined, "Web_1"))).toBe("error.badHostname");
    expect(err(installOs(s, id, "lunix", undefined, undefined, undefined, "-web"))).toBe("error.badHostname");
    expect(err(installOs(s, id, "lunix", undefined, undefined, undefined, other))).toBe("error.hostnameTaken");
    expect(installOs(s, id, "lunix", undefined, undefined, undefined, "node090").ok).toBe(true);
  });

  it("names the server after install", () => {
    const s = readyGame(7), id = atInstaller(s);
    expect(installOs(s, id, "lunix", undefined, undefined, undefined, "db-1").ok).toBe(true);
    expect(s.devices.find((d) => d.id === id)!.hostname).toBe("db-1");
  });
});
