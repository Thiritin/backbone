import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hashRng } from "../src/sim/00-core/rng";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { sizeSpec } from "../src/sim/10-catalog/products";
import type { GameState } from "../src/sim/50-state";
import { lostDisk } from "../src/sim/60-infra/cluster";
import { seize } from "../src/sim/60-infra/incidents";
import { cliCommands, vendorCli } from "../src/sim/60-infra/vendor-cli";
import { tick } from "../src/sim/88-tick/tick";
import { connect } from "../src/sim/90-actions/hardware";
import { provisionService, setBackup } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import type { Call } from "../src/sim/90-actions/index";
import { buyDevice, hypervisor, named, newGame, panelServer, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const FRAG = { ...sizeSpec("gameServer", 0, 2005), vcpu: 2, ramGb: 4, diskGb: 10 };
const must = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
function server(s: GameState, slot: number, port: number) {
  const id = must(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  must(mountDevice(s, id, "rack2", slot));
  must(connect(s, { device: id, port: 0 }, { device: "dev4", port }));
  return id;
}
const bconsola = (s: GameState, at: string, line: string, root = false) => {
  const r = vendorCli(s, at, "bconsola", line.split(" "), root)!;
  if (r.action) { const [fn, ...args] = r.action as Call; must(fn(s, ...args)); }
  return r;
};

describe("Backula from the terminal", () => {
  it("lists finished jobs and lost machines and restores one onto a named node", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const second = server(s, 2, 1), third = server(s, 3, 2), fourth = server(s, 4, 3);
    const cluster = hypervisor(s, ["dev3", second], "Cloud 1");
    const backup = named(s, panelServer(s, third, "backula"), "Backup 1");
    const other = hypervisor(s, [fourth], "Cloud 2"), node = s.devices.find((d) => d.id === fourth)!;
    const gamer = addCustomer(s, "Gus Gamer", "gamer");
    for (const at of ["dev3", "dev3", second]) must(provisionService(s, gamer, "gameServer", { label: "Frag", spec: FRAG, clusterId: cluster, deviceId: at }));
    must(setBackup(s, cluster, backup, "daily"));
    run(s, 30);
    expect(bconsola(s, third, "job list").output.join("\n")).toMatch(/^Cloud 1 .+ {2}OK$/m);
    expect(bconsola(s, third, "restore list").output).toEqual(["No entries."]);
    expect(bconsola(s, third, "status").output).toEqual(["Backula is running."]);
    expect(bconsola(s, third, "upgrade --key ABC", true)).toMatchObject({ failed: true, output: ["Usage: bconsola upgrade"] });

    seize(s, "dev3", "Europoll", hashRng(1), []);
    const w = s.workloads.find((x) => x.deviceId === "dev3")!, name = w.hostname ?? w.id;
    expect(lostDisk(s, w)).toBe(true);
    expect(bconsola(s, third, "restore list").output.join("\n")).toContain(name);
    expect(bconsola(s, third, `restore ${name}`).output).toEqual(["bconsola: permission denied, run it as root or with sudo"]);
    expect(bconsola(s, third, `restore ${name} nowhere`, true).output).toEqual(["bconsola: nowhere: not found"]);
    expect(bconsola(s, third, `restore ${name} ${node.hostname}`, true).failed).toBeUndefined();
    const moved = s.workloads.find((x) => x.id === w.id)!;
    expect(moved).toMatchObject({ deviceId: fourth, clusterId: other });
    expect(lostDisk(s, moved)).toBe(false);
  });
});

describe("licence commands", () => {
  const text = (id: string) => cliCommands(softwareById(id)).map((c) => `${c.syntax} ${t(`browser-sites-2.cli.${c.doc}`)}`).join("\n");
  it("leave --key and license wording out of free software and keep them on licensed software", () => {
    expect(text("backula")).not.toMatch(/--key|license|licence/i);
    expect(text("veeham")).toContain("upgrade [--key <key>]");
    expect(text("veeham")).toContain("license set <key>");
    expect(text("veeham")).toContain("--key enters the upgrade key");
  });
});
