import { describe, expect, it } from "vitest";
import { conflict, runsOn, SOFTWARE, softwareById } from "../src/sim/10-catalog/platforms";
import type { ServerOsId } from "../src/sim/10-catalog/server-os";
import { newGame, type GameState } from "../src/sim/50-state";
import { setMachine } from "../src/sim/60-infra/cluster";
import { installBlock } from "../src/sim/90-actions/software";
import { hypervisor, skipTo, withServer } from "./fixtures";

// The basement server in 2016 with the OS and software given on its disk.
function machine(os: ServerOsId, ...software: string[]): GameState {
  const s = withServer(newGame(1));
  skipTo(s, 2016);
  setMachine(s, "dev3", () => ({
    os: { id: os, version: "x", installedAt: 0 },
    software: software.map((id) => ({ id, version: "2016", installedAt: 0, doneAt: null })),
  }));
  return s;
}

describe("software compatibility", () => {
  it("refuses every pair that shares a port or is two hypervisors, both ways round", () => {
    for (const a of SOFTWARE) for (const b of SOFTWARE) {
      const why = conflict(a, b);
      expect(why, `${a.id} ${b.id}`).toBe(conflict(b, a));
      const expected = a.kind === "cloud" && b.kind === "cloud" ? "error.oneHypervisor" : a.ports.some((p) => b.ports.includes(p)) ? "error.portTaken" : null;
      expect(why, `${a.id} ${b.id}`).toBe(expected);
    }
    expect(SOFTWARE.every((a) => conflict(a, a) !== null)).toBe(true);
    expect(runsOn(softwareById("pleskit"), "windoors")).toBe(true);
    expect(runsOn(softwareById("cpanic"), "windoors")).toBe(false);
  });

  it("refuses a web panel next to Mailpig and a VPN on 443 next to a panel", () => {
    expect(installBlock(machine("lunix", "mailpig"), "dev3", "cpanic")).toBe("error.portTaken");
    expect(installBlock(machine("lunix", "freepanel"), "dev3", "anyconnekt")).toBe("error.portTaken");
    expect(installBlock(machine("lunix", "bound"), "dev3", "powerdnz")).toBe("error.portTaken");
  });

  it("accepts Bound, OpenVeePeeN and a panel on one host", () => {
    expect(installBlock(machine("lunix", "bound"), "dev3", "openveepeen")).toBeNull();
    expect(installBlock(machine("lunix", "bound", "openveepeen"), "dev3", "cpanic")).toBeNull();
  });

  it("refuses two hypervisors, ports or none", () => {
    expect(installBlock(machine("lunix", "proxmocks"), "dev3", "openstash")).toBe("error.oneHypervisor");
    expect(installBlock(machine("lunix", "openveezee"), "dev3", "proxmocks")).toBe("error.oneHypervisor");
  });

  it("refuses HyperVee and TCAdmen on Lunix and cPanic on Windoors, and takes TCAdmen next to HyperVee", () => {
    expect(installBlock(machine("lunix"), "dev3", "hypervee")).toBe("error.wrongOs");
    expect(installBlock(machine("lunix"), "dev3", "tcadmen")).toBe("error.wrongOs");
    expect(installBlock(machine("windoors"), "dev3", "cpanic")).toBe("error.wrongOs");
    expect(installBlock(machine("windoors", "hypervee"), "dev3", "tcadmen")).toBeNull();
  });

  it("refuses a panel on a Proxmocks node as a second cluster, and the installer that erases the disk takes anything", () => {
    const s = withServer(newGame(1));
    skipTo(s, 2010);
    hypervisor(s, ["dev3"]);
    expect(installBlock(s, "dev3", "freepanel")).toBe("error.serverInUse");
    expect(installBlock(s, "dev3", "openstash")).toBe("error.oneHypervisor");
    expect(installBlock(s, "dev3", "openstash", true)).toBeNull();
    expect(installBlock(s, "dev3", "hypervee", true)).toBeNull();
  });
});
