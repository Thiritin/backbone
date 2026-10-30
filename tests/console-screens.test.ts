import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { nowHours } from "../src/sim/00-core/time";
import { newGame, type Device, type GameState } from "../src/sim/50-state";
import { setMachine, vmById } from "../src/sim/60-infra/cluster";
import { machineScreen } from "../src/sim/60-infra/oob";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { setMedia } from "../src/sim/90-actions/console";
import { installSoftware } from "../src/sim/90-actions/software";
import { Screen } from "../src/ui/apps/console/Screen";
import { VmConsole } from "../src/ui/apps/console/VmConsole";
import { bootedMachine, hypervisor, skipTo, withServer, withImage, withStick } from "./fixtures";

// withServer: dev3 is a free server cabled to the desk's router. The console's login lives in the tab's session storage.
const store = new Map<string, string>();
Object.assign(globalThis, { sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
const logIn = (m: { id: string; bootUntil?: number }) => store.set(`backbone.ui.console.${m.id}.login`, JSON.stringify(m.bootUntil ?? 0));

function server(year: number, os: "lunix" | "windoors" | null = "lunix") {
  const s = withServer(newGame(5));
  skipTo(s, year);
  if (os) bootedMachine(s, "dev3", os);
  const d = s.devices.find((x) => x.id === "dev3")!;
  return { s, d, host: d.hostname! };
}
const html = (s: GameState, d: Device) => renderToString(createElement(Screen, { game: s, device: d, via: "bmc" }));

beforeEach(() => store.clear());

describe("the console screen by machine state", () => {
  it("keeps the firmware screens: no signal, POST, the stuck prompt, setup and nothing to boot", () => {
    const { s, d } = server(2005);
    d.on = false;
    expect(machineScreen(s, d.id).kind).toBe("dark");
    expect(html(s, d)).toContain("No signal");
    d.on = true;
    d.bootUntil = nowHours(s) + 0.5;
    expect(machineScreen(s, d.id).kind).toBe("post");
    expect(html(s, d)).toContain("Press DEL to enter SETUP, F11 for Boot Menu");
    d.bootUntil = 0;
    d.stuck = true;
    expect(html(s, d)).toContain("CMOS checksum error");
    d.stuck = false;
    d.setup = true;
    expect(machineScreen(s, d.id).kind).toBe("setup");
    expect(html(s, d)).toContain('data-look="bios"');
    d.setup = false;
    setMachine(s, d.id, () => ({ os: null, software: [] }));
    expect(html(s, d)).toContain("Operating system not found");
  });

  it("starts the Debiant installer or Windoors Setup of the year from the stick", () => {
    const { s, d } = server(2005, null);
    withStick(s, d.id);
    d.bootFrom = "usb";
    expect(machineScreen(s, d.id)).toEqual({ kind: "bootMenu", media: ["lunix"] });
    expect(html(s, d)).toContain("Debiant GNU/Lunix 3.1 installer boot menu");
    withStick(s, d.id, "windoors");
    expect(html(s, d)).toContain("Welcome to Setup.");
    skipTo(s, 2012);
    expect(html(s, d)).toContain("Install now");
  });

  it("shows the install over its hours in each installer's own look", () => {
    const { s, d } = server(2005);
    d.os = { ...d.os!, installedAt: nowHours(s) + 0.5 };
    expect(machineScreen(s, d.id)).toMatchObject({ kind: "osInstall", os: "lunix", progress: 0.5 });
    expect(html(s, d)).toContain("Install the system");
    d.os = { id: "windoors", version: "2003", installedAt: nowHours(s) + 1.8 };
    expect(html(s, d)).toContain("Setup is copying files");
    d.os = { id: "windoors", version: "2003", installedAt: nowHours(s) + 0.6 };
    expect(html(s, d)).toContain("Setup will complete in approximately");
    d.os = { id: "windoors", version: "2016", installedAt: nowHours(s) + 1.5 };
    expect(html(s, d)).toContain("Getting files ready for installation");
  });

  it("boots Lunix with plain lines before Debiant 8 and green OK lines from it, then the tty1 login", () => {
    const early = server(2005), late = server(2016);
    for (const { s, d } of [early, late]) d.bootUntil = nowHours(s) + 0.01;
    expect(machineScreen(early.s, "dev3")).toEqual({ kind: "booting", os: "lunix" });
    expect(html(early.s, early.d)).not.toContain("[  OK  ]");
    expect(html(late.s, late.d)).toContain("[  OK  ]");
    for (const { d } of [early, late]) d.bootUntil = 0;
    expect(html(late.s, late.d)).toContain(`Debiant GNU/Lunix 8 ${late.host} tty1`);
    expect(html(late.s, late.d)).toContain(`${late.host} login:`);
    expect(html(late.s, late.d)).not.toMatch(/Debian(?!t)/);
  });

  it("opens the shell on the machine after the login, and VMwhere's direct console on a VMwhere host", () => {
    const { s, d, host } = server(2016);
    logIn(d);
    expect(html(s, d)).toContain(`root@${host}:~#`);
    const v = server(2016);
    hypervisor(v.s, ["dev3"], undefined, "vmwhere");
    logIn(v.d);
    expect(html(v.s, v.d)).toContain("VMwhere ESXi");
  });

  it("boots Windoors to its logon and its desktop with Server Manager in three eras", () => {
    for (const [year, logon, manager] of [[2005, "Press Ctrl-Alt-Delete to begin.", "Manage Your Server"], [2010, "Press Ctrl+Alt+Delete to log on.", "Roles Summary"], [2017, "Press Ctrl+Alt+Delete to unlock.", "Add roles and features"]] as const) {
      store.clear();
      const { s, d } = server(year, "windoors");
      d.bootUntil = nowHours(s) + 0.1;
      expect(machineScreen(s, d.id)).toEqual({ kind: "booting", os: "windoors" });
      expect(html(s, d)).toContain(`Windoors Server ${d.os!.version}`);
      d.bootUntil = 0;
      expect(html(s, d)).toContain(logon);
      logIn(d);
      expect(machineScreen(s, d.id, true).kind).toBe("desktop");
      const desk = html(s, d);
      expect(desk).toContain(manager);
      expect(desk).toMatch(/>start</i);
    }
  });

  it("lists TCAdmen as installing on the Windoors desktop while its hours run", () => {
    const { s, d } = server(2005, "windoors");
    expect(installSoftware(s, d.id, "tcadmen").ok).toBe(true);
    logIn(d);
    expect(machineScreen(s, d.id, true).kind).toBe("installing");
    expect(html(s, d)).toContain("Installing");
  });

  it("gives an own VM the installer of its ISO and the OS's screens after", () => {
    const { s } = server(2016);
    const c = hypervisor(s, ["dev3"]), made = createVm(s, c, PANEL_VM_SIZE), w = vmById(s, made.ok ? made.id! : "")!;
    const vm = () => renderToString(createElement(VmConsole, { game: s, vm: vmById(s, w.id)!, front: false }));
    expect(vm()).toContain("Operating system not found");
    withImage(s, "windoors");
    setMedia(s, w.id, "windoors");
    expect(vm()).toContain("Install now");
    setMedia(s, w.id, null);
    bootedMachine(s, w.id, "lunix");
    expect(vm()).toContain(`${w.hostname} login:`);
  });
});
