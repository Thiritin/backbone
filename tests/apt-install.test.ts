import { describe, expect, it } from "vitest";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { newGame, type GameState } from "../src/sim/50-state";
import { clusterOf, vmById } from "../src/sim/60-infra/cluster";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { runLine, watchStep, type Session, type Watch } from "../src/sim/60-infra/terminal";
import { tick } from "../src/sim/88-tick/tick";
import type { Call } from "../src/sim/90-actions/index";
import { softwareOn } from "../src/sim/90-actions/software";
import { installLog } from "../src/sim/60-infra/apt";
import { privateIp } from "../src/sim/60-infra/addresses";
import { bootedMachine, hypervisor, skipTo, withServer } from "./fixtures";

// withServer: dev3 is a free server cabled to the desk's router; booted here with an OS.
const act = (s: GameState) => ([fn, ...args]: Call) => fn(s, ...args);
const run = (s: GameState, line: string, session: Session | null) => runLine(() => s, act(s), session, null, line);
const text = (s: GameState, line: string, session: Session | null) => run(s, line, session).output.join("\n");
const PROXMOCKS = softwareById("proxmocks").install.commands;

function server(os: "lunix" | "windoors" = "lunix", year = 2017) {
  const s = withServer(newGame(5));
  skipTo(s, year);
  bootedMachine(s, "dev3", os);
  const host = s.devices.find((d) => d.id === "dev3")!.hostname!;
  return { s, host, at: { host, deviceId: "dev3" } as Session };
}

describe("installing software from the shell", () => {
  it("opens a session on a booted Lunix server, refuses on Windoors and times out on an empty disk", () => {
    const { s, host } = server();
    expect(run(s, `ssh ${host}`, null).session).toEqual({ host, deviceId: "dev3" });
    const win = server("windoors");
    expect(text(win.s, `ssh ${win.host}`, null)).toBe(`ssh: connect to host ${win.host} port 22: Connection refused`);
    const empty = withServer(newGame(5)), name = empty.devices.find((d) => d.id === "dev3")!.hostname!;
    expect(text(empty, `ssh ${name}`, null)).toBe(`ssh: connect to host ${name} port 22: Connection timed out`);
  });

  it("installs Proxmocks from its three lines in order and prints the progress over its hours", () => {
    const { s, at } = server(), hours = softwareById("proxmocks").installHours;
    expect(text(s, PROXMOCKS[0], at)).toBe("");
    text(s, PROXMOCKS[1], at);
    const r = run(s, PROXMOCKS[2], at);
    expect(r.output).toContain("  proxmocks-ve");
    const log = installLog(softwareById("proxmocks"));
    expect(r.output.slice(-2)).toEqual(log.slice(0, 2));
    expect(r.output.at(-2)).toBe("Get:1 http://deb.debiant.org/debiant stable/main amd64 proxmocks-ve amd64 [48.2 MB]");
    expect(softwareOn(s, "dev3")[0]).toMatchObject({ id: "proxmocks" });
    let w: Watch | null = r.watch[0];
    const byHour: string[][] = [];
    for (let h = 0; h < hours && w; h++) {
      tick(s);
      const step = watchStep(s, w);
      byHour.push(step.output);
      w = step.next;
    }
    expect(w).toBeNull();
    expect(s.company.domain).toBeNull();
    expect(byHour).toEqual([[log[2]], [log[3], log[4]], [log[5], "Proxmocks installation complete.", `You can access your new installation at https://${privateIp(s, "dev3")}/`, "Reboot now to finish the installation."]]);
    expect(clusterOf(s, "dev3")?.platform).toBe("proxmocks");
    expect(text(s, "dpkg -l", at)).toMatch(/ii {2}proxmocks-ve +2017 +amd64 +Proxmocks/);
  });

  it("does not find the package before its repo line, nor a script software's name", () => {
    const { s, at } = server();
    expect(text(s, "apt-get install -y proxmocks-ve", at)).toBe("E: Unable to locate package proxmocks-ve");
    expect(text(s, "apt-get install -y cpanic", at)).toBe("E: Unable to locate package cpanic");
    expect(softwareOn(s, "dev3")).toHaveLength(0);
  });

  it("asks before an install without -y", () => {
    const { s, at } = server();
    const r = run(s, "apt install freepanel", at);
    expect(r.confirm).toBe("apt install freepanel -y");
    expect(softwareOn(s, "dev3")).toHaveLength(0);
    run(s, r.confirm!, at);
    expect(softwareOn(s, "dev3")[0]).toMatchObject({ id: "freepanel" });
  });

  it("installs cPanic from its one-liner, matched whole with any spacing", () => {
    const { s, at } = server();
    const line = softwareById("cpanic").install.commands[0].replace(/ /g, "   ");
    const r = run(s, ` ${line} `, at);
    expect(r.output).toEqual(["Starting the cPanic installer ...", ...installLog(softwareById("cpanic")).slice(0, 4)]);
    expect(softwareOn(s, "dev3")[0]).toMatchObject({ id: "cpanic" });
    expect(text(s, "curl -o latest -L https://securedownloads.cpanic.net/latest", at)).toBe("curl: (6) Could not resolve host: securedownloads.cpanic.net");
  });

  it("removes software through apt, refuses while it serves, prints the OS in uname and lists nothing on a fresh disk", () => {
    const { s, at } = server();
    expect(text(s, "dpkg -l", at).split("\n")).toHaveLength(4);
    expect(text(s, "uname -a", at)).toMatch(/^Lunix .* GNU\/Lunix 9 \(stretch\)$/);
    run(s, "apt-get install -y bound9", at);
    for (let h = 0; h < 4; h++) tick(s);
    expect(text(s, "apt-get remove bound9", at)).toContain("Removing bound9 ...");
    expect(softwareOn(s, "dev3")).toHaveLength(0);
    run(s, "apt-get install -y freepanel", at);
    for (let h = 0; h < 4; h++) tick(s);
    expect(text(s, "apt-get remove freepanel", at)).toContain("Workloads still run on this software.");
    expect(text(s, "apt-get remove bound9", at)).toContain("Package 'bound9' is not installed, so not removed");
  });

  it("opens a session on an own VM with Lunix booted, refuses one with Windoors and times out on an empty one", () => {
    const s = withServer(newGame(5));
    skipTo(s, 2017);
    const c = hypervisor(s, ["dev3"]);
    const vm = (os?: "lunix" | "windoors") => {
      const r = createVm(s, c, PANEL_VM_SIZE), w = vmById(s, r.ok ? r.id! : "")!;
      if (os) bootedMachine(s, w.id, os);
      return w;
    };
    const lunix = vm("lunix"), win = vm("windoors"), empty = vm();
    expect(run(s, `ssh ${lunix.hostname}`, null).session).toEqual({ host: lunix.hostname, deviceId: lunix.id });
    expect(text(s, `ssh ${win.hostname}`, null)).toBe(`ssh: connect to host ${win.hostname} port 22: Connection refused`);
    expect(text(s, `ssh ${empty.hostname}`, null)).toBe(`ssh: connect to host ${empty.hostname} port 22: Connection timed out`);
  });
});
