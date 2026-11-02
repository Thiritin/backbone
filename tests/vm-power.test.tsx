import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { serverOsById } from "../src/sim/10-catalog/server-os";
import type { GameState } from "../src/sim/50-state";
import { workloadOnline } from "../src/sim/60-infra/cluster";
import { machineScreen } from "../src/sim/60-infra/oob";
import { sessionStep, type Session } from "../src/sim/60-infra/terminal";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { tickMinute } from "../src/sim/88-tick/tick";
import { freezeWorkload } from "../src/sim/90-actions/openveezee";
import { createVm } from "../src/sim/90-actions/clusters";
import { rebootWorkload, startWorkload, stopWorkload } from "../src/sim/90-actions/vms";
import { useVms } from "../src/ui/apps/browser/consoles/HypervisorBase";
import { useAsk } from "../src/ui/desktop/Confirm";
import { useStore } from "../src/ui/store";
import { bootedMachine, skipTo } from "./fixtures";
import { err, ok, pmx } from "./pmx";

const { haltMinutes, bootMinutes } = serverOsById("lunix");

// An OpenVeeZee container of the player's on dev3 with Lunix booted, and a customer-like one without an OS.
function ovz() {
  const x = pmx(2);
  x.s.clusters = x.s.clusters.map((c) => (c.id === x.c ? { ...c, platform: "openveezee" } : c));
  skipTo(x.s, 2009);
  const id = ok(createVm(x.s, x.c, { vcpu: 1, ramGb: 2, diskGb: 40 }));
  x.s.workloads = x.s.workloads.map((w) => (w.id === id ? { ...w, deviceId: "dev3", busyUntil: 0, media: undefined } : w));
  bootedMachine(x.s, id);
  const w = () => x.s.workloads.find((v) => v.id === id)!;
  return { ...x, id, w, screen: () => machineScreen(x.s, id).kind };
}
const minutes = (s: GameState, n: number) => { for (let i = 0; i < n; i++) tickMinute(s); };

describe("VM power", () => {
  it("boots for the OS's boot minutes after a start and is offline meanwhile", () => {
    const x = ovz();
    ok(stopWorkload(x.s, x.id));
    minutes(x.s, haltMinutes + 1);
    expect(x.w().stopped).toBe(true);
    ok(startWorkload(x.s, x.id));
    expect(x.screen()).toBe("booting");
    expect(workloadOnline(x.s, x.w())).toBe(false);
    minutes(x.s, bootMinutes + 1);
    expect(x.screen()).toBe("login");
    expect(workloadOnline(x.s, x.w())).toBe(true);
  });

  it("halts for the OS's halt minutes before it stops, offline and refusing a start meanwhile", () => {
    const x = ovz();
    expect(workloadOnline(x.s, x.w())).toBe(true);
    ok(stopWorkload(x.s, x.id));
    expect(x.w().stopped).toBe(false);
    expect(x.screen()).toBe("halting");
    expect(workloadOnline(x.s, x.w())).toBe(false);
    expect(err(startWorkload(x.s, x.id))).toBe("error.workloadBusy");
    ok(stopWorkload(x.s, x.id));
    minutes(x.s, haltMinutes + 1);
    expect(x.w().stopped).toBe(true);
    expect(x.screen()).toBe("dark");
  });

  it("stops a VM without a booted OS at once", () => {
    const x = ovz();
    x.s.workloads = x.s.workloads.map((w) => (w.id === x.id ? { ...w, os: null } : w));
    ok(stopWorkload(x.s, x.id));
    expect(x.w().stopped).toBe(true);
  });

  it("reboots through the halt and the boot back to the login", () => {
    const x = ovz();
    ok(rebootWorkload(x.s, x.id));
    expect(x.screen()).toBe("halting");
    minutes(x.s, haltMinutes + 1);
    expect(x.w().stopped).toBe(false);
    expect(x.screen()).toBe("booting");
    minutes(x.s, bootMinutes + 1);
    expect(x.screen()).toBe("login");
  });

  it("keeps a checkpointed container's picture", () => {
    const x = ovz();
    ok(freezeWorkload(x.s, x.id));
    expect(x.screen()).toBe("login");
  });

  it("broadcasts the shutdown to an ssh session, then drops it", () => {
    const x = ovz();
    let session: Session | null = { host: "vm1", deviceId: x.id };
    expect(sessionStep(x.s, session).next).toBe(session);
    ok(stopWorkload(x.s, x.id));
    const warn = sessionStep(x.s, session);
    expect(warn.output).toEqual(["Broadcast message from root@vm1", "The system is going down for system halt NOW!"]);
    session = warn.next;
    expect(sessionStep(x.s, session)).toEqual({ output: [], next: session });
    minutes(x.s, haltMinutes + 1);
    expect(sessionStep(x.s, session)).toEqual({ output: ["Connection to vm1 closed."], next: null });
  });

  it("names a reboot in the broadcast and drops the session as the VM boots", () => {
    const x = ovz();
    ok(rebootWorkload(x.s, x.id));
    const warn = sessionStep(x.s, { host: "vm1", deviceId: x.id });
    expect(warn.output[1]).toBe("The system is going down for reboot NOW!");
    minutes(x.s, haltMinutes + 1);
    expect(sessionStep(x.s, warn.next).next).toBeNull();
  });

  it("asks before the hypervisor console checkpoints a container", () => {
    const x = ovz();
    useStore.setState({ game: x.s, alert: null });
    useAsk.setState({ ask: null });
    let vms: ReturnType<typeof useVms>["vms"] = [];
    const View = () => { vms = useVms(x.s, x.s.clusters.find((c) => c.id === x.c)!, consoleFeatures("openveezee", yearOf(x.s.hour))).vms; return null; };
    renderToString(<View />);
    vms.find((v) => v.id === x.id)!.actions.find((a) => a.id === "checkpoint")!.run();
    const game = () => useStore.getState().game.workloads.find((w) => w.id === x.id)!;
    const asked = useAsk.getState().ask!;
    expect(asked.text).toContain("saves the memory");
    expect(game().frozen).toBeFalsy();
    asked.run();
    expect(game().frozen).toBe(true);
  });
});
