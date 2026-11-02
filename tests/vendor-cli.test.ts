import { describe, expect, it } from "vitest";
import { type GameState } from "../src/sim/50-state";
import { assignedKey, issueKey, panelMachine, trialOf } from "../src/sim/60-infra/licence";
import { complete, runLine, type Session } from "../src/sim/60-infra/terminal";
import { vendorCli } from "../src/sim/60-infra/vendor-cli";
import type { Call } from "../src/sim/90-actions/index";
import { hypervisor, newGame, panelVm, skipTo, withNames, withServer } from "./fixtures";

const act = (s: GameState) => ([fn, ...args]: Call) => fn(s, ...args);
const text = (s: GameState, line: string, at: Session) => runLine(() => s, act(s), at, null, line).output.join("\n");
const hostOf = (s: GameState, id: string) => (s.devices.find((d) => d.id === id) ?? s.workloads.find((w) => w.id === id))!.hostname!;

// A VMwhere cluster on dev3 with a cPanic panel host in one of its VMs.
function setup() {
  const s = withServer(newGame(7));
  skipTo(s, 2012);
  const cloud = hypervisor(s, ["dev3"], undefined, "vmwhere"), panel = panelVm(s, cloud, "cpanic");
  withNames(s);
  const vm = panelMachine(s.clusters.find((c) => c.id === panel)!)!;
  const cluster = (id: string) => s.clusters.find((c) => c.id === id)!;
  return { s, cloud, panel, vm, cluster, node: { host: hostOf(s, "dev3"), deviceId: "dev3" }, guest: { host: hostOf(s, vm), deviceId: vm } };
}

describe("vendor command line tools", () => {
  it("lists the commands of a bare call and prints version and status", () => {
    const { s, node } = setup();
    const usage = text(s, "esxwhere", node);
    expect(usage).toContain("Usage: esxwhere <command>");
    expect(usage).toContain("  esxwhere vm list");
    expect(usage).toContain("  esxwhere trial");
    expect(usage).not.toContain("license tier");
    expect(text(s, "esxwhere version", node)).toMatch(/^VMwhere .+, channel release$/);
    expect(text(s, "esxwhere status", node)).toBe("VMwhere is running.\nLicense: active");
    const { guest } = setup();
    expect(text(s, "esxwhere vm list", node)).toMatch(new RegExp(`^${guest.host} +running$`));
  });

  it("switches the channel and automatic updates and runs a due update", () => {
    const { s, cloud, cluster, node } = setup();
    text(s, "esxwhere channel edge", node);
    expect(cluster(cloud).channel).toBe("edge");
    expect(text(s, "esxwhere channel nightly", node)).toBe("Usage: esxwhere channel stable|release|edge");
    s.clusters = s.clusters.map((c) => (c.id === cloud ? { ...c, version: 2008 } : c));
    text(s, "esxwhere update", node);
    expect(cluster(cloud).version).toBeGreaterThan(2008);
  });

  it("assigns a key and shows it, without a command to change the edition", () => {
    const { s, panel, vm, guest } = setup();
    const k = issueKey(s, "cpanic", "solo");
    expect(text(s, `cpanic license set ${k.key}`, guest)).toBe("");
    expect(assignedKey(s, vm, "cpanic")!.id).toBe(k.id);
    expect(text(s, "cpanic license show", guest)).toContain(`Key: ${k.key}\nEdition: Solo`);
    expect(text(s, "cpanic license set NOPE-0000", guest)).toBe("This licence key is not valid.");
    expect(text(s, "cpanic license tier pro", guest)).toContain("Usage: cpanic <command>");
    expect(assignedKey(s, vm, "cpanic")!.edition).toBe("solo");
    expect(s.clusters.find((c) => c.id === panel)!.kind).toBe("panel");
  });

  it("starts a trial once per machine", () => {
    const { s, node } = setup();
    expect(trialOf(s, "dev3", "vmwhere")).toBeUndefined();
    expect(text(s, "esxwhere trial", node)).toBe("");
    expect(trialOf(s, "dev3", "vmwhere")).toBeDefined();
    expect(text(s, "esxwhere trial", node)).toBe("No trial is available for this software on this machine.");
  });

  it("refuses a state change without root and leaves reads open", () => {
    const { s } = setup();
    const r = vendorCli(s, "dev3", "esxwhere", ["update"], false)!;
    expect(r).toMatchObject({ failed: true, output: ["esxwhere: permission denied, run it as root or with sudo"] });
    expect(r.action).toBeUndefined();
    expect(vendorCli(s, "dev3", "esxwhere", ["version"], false)!.failed).toBeUndefined();
  });

  it("finds no binary of software the machine does not run", () => {
    const { s, node, guest } = setup();
    expect(text(s, "cpanic version", node)).toBe("bash: cpanic: command not found");
    expect(text(s, "esxwhere version", guest)).toBe("bash: esxwhere: command not found");
    expect(text(s, "mailpig status", guest)).toBe("bash: mailpig: command not found");
  });

  it("completes the binary and its first words", () => {
    const { s, node } = setup();
    expect(complete(s, node, "esxw").line).toBe("esxwhere ");
    expect(complete(s, node, "esxwhere v").options).toEqual(["version", "vm"]);
  });
});
