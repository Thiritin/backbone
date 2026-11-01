import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { clusterDefaults } from "../src/sim/60-infra/cluster";
import { editionAllows, editionOf } from "../src/sim/60-infra/vmwhere";
import { tick } from "../src/sim/88-tick/tick";
import { setHa } from "../src/sim/90-actions/clusters";
import { upgradeEdition } from "../src/sim/90-actions/vmwhere";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, withServer } from "./fixtures";

const setup = () => {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  s.unlocks = [...s.unlocks, "virtualization"];
  const c = hypervisor(s, ["dev3"], "VW", "vmwhere");
  // The install finishing is what puts a new cluster on Essentials.
  s.clusters = s.clusters.map((x) => (x.id === c ? { ...x, platform: null, licence: undefined, switching: { kind: "cloud" as const, to: "vmwhere", doneAt: s.hour } } : x));
  tick(s);
  return { s, c };
};
const cl = (s: GameState, id: string) => s.clusters.find((x) => x.id === id)!;

describe("VMwhere editions", () => {
  it("starts a new cluster on Essentials and refuses failover", () => {
    const { s, c } = setup();
    expect(editionOf(cl(s, c))).toBe("essentials");
    expect(editionAllows(cl(s, c), "failover")).toBe(false);
    expect(setHa(s, c, "failover", true)).toEqual({ ok: false, error: "error.needsEdition" });
  });

  it("upgrade charges the fee per node and unlocks the gate", () => {
    const { s, c } = setup();
    const cash = s.cash;
    expect(upgradeEdition(s, c, "standard")).toMatchObject({ ok: true });
    expect(cash - s.cash).toBe(600);
    expect(setHa(s, c, "failover", true)).toMatchObject({ ok: true });
    expect(editionAllows(cl(s, c), "drs")).toBe(false);
    expect(upgradeEdition(s, c, "essentials")).toEqual({ ok: false, error: "error.editionNotHigher" });
    expect(upgradeEdition(s, c, "enterprise")).toMatchObject({ ok: true });
    expect(cash - s.cash).toBe(600 + 1200);
    expect(editionAllows(cl(s, c), "pools")).toBe(true);
  });

  it("an old VMwhere cluster without a tier loads as Enterprise", () => {
    const { s, c } = setup();
    const old = { ...cl(s, c) } as Partial<ReturnType<typeof cl>>;
    delete old.licence;
    s.clusters = s.clusters.map((x) => (x.id === c ? (old as ReturnType<typeof cl>) : x));
    const back = deserialize(serialize(s))!;
    expect(editionOf(cl(back, c))).toBe("enterprise");
    expect(clusterDefaults({ nodes: [], platform: "vmwhere" }).licence?.tier).toBe("enterprise");
  });
});
