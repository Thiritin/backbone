import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { LATENCY_MS, QUEUEING } from "../src/sim/10-catalog/network";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { latency, loadOf, route } from "../src/sim/60-infra/network";
import { pathTo, type Hop } from "../src/sim/60-infra/status";
import { complete, deskRouter, recoveryReport, runCommand, type Session } from "../src/sim/60-infra/terminal";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { addLocation, buyRack, connect } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { hire, setTechRules } from "../src/sim/90-actions/staff";
import { mountDevice } from "./plugged";
import { readyGame } from "./fixtures";

const base = readyGame(3);
const fresh = (): GameState => structuredClone(base);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const must = (r: { ok: boolean; id?: string; error?: string }): string => {
  if (!r.ok) throw new Error(r.error);
  return r.id ?? "";
};
const host = (s: GameState) => dev(s, "dev3").hostname!;
const out = (s: GameState, session: Session | null, line: string) => runCommand(s, session, line).output.join("\n");
const login = (s: GameState): Session => runCommand(s, null, `ssh ${host(s)}`).session!;

// A ready rented position in Frankfurt with one server cabled to the datacenter's handoff.
function datacenter(s: GameState) {
  s.cash = 1e6;
  const loc = must(addLocation(s, "hetzler-park", "positions", 1));
  s.locations = s.locations.map((l) => (l.id === loc ? { ...l, readyAt: s.hour } : l));
  const rack = must(buyRack(s, loc, "rack-42", 1));
  s.racks = s.racks.map((r) => (r.id === rack ? { ...r, arriveAt: null } : r));
  const srv = must(buyDevice(s, "g1-compute", "Dwell", 1, loc));
  must(mountDevice(s, srv, rack, 1));
  s.devices = s.devices.map((d) => (d.id === srv ? { ...d, hostname: "node002" } : d));
  must(connect(s, { device: srv, port: 0 }, { device: s.devices.find((d) => d.panel === loc)!.id, port: 0 }));
  return { loc, srv };
}

describe("network path", () => {
  it("lists the hops from the home router to a basement server", () => {
    const s = fresh();
    const hops = pathTo(s, deskRouter(s)!, "dev3")!;
    expect(hops.map((h) => h.kind)).toEqual(["gateway", "switch", "host"]);
    expect(hops.at(-1)!.name).toBe(host(s));
  });

  it("goes through the home line and the datacenter's uplink to a datacenter server", () => {
    const s = fresh();
    const { srv } = datacenter(s);
    expect(pathTo(s, deskRouter(s)!, srv)!.map((h) => h.kind)).toEqual(["gateway", "line", "uplink", "host"]);
  });

  it("has no route through a stopped switch, and the cabled route still shows it", () => {
    const s = fresh();
    dev(s, "dev4").on = false;
    expect(pathTo(s, deskRouter(s)!, "dev3")).toBeNull();
    expect(pathTo(s, deskRouter(s)!, "dev3", false)!.map((h) => h.kind)).toEqual(["gateway", "switch", "host"]);
  });
});

describe("latency", () => {
  const hop = (kind: Hop["kind"]): Hop => ({ kind, name: kind });

  it("sums the milliseconds of every hop kind", () => {
    const s = fresh();
    const kinds: Hop["kind"][] = ["gateway", "line", "uplink", "firewall", "switch", "host"];
    const { ms, loss } = latency(s, kinds.map(hop));
    expect(ms.reduce((a, b) => a + b, 0)).toBeCloseTo(1 + 18 + 3 + 1 + 0.2, 6);
    expect(loss).toBe(0);
    for (const k of ["domestic", "european", "overseas"] as const) expect(latency(s, [hop(k)]).ms[0]).toBe(LATENCY_MS[k]);
  });

  it("gets the home line down to 8 ms from 2015", () => {
    const s = fresh();
    s.hour = hourOf(new Date(Date.UTC(2015, 0, 1)));
    expect(latency(s, [hop("line")]).ms[0]).toBe(8);
  });

  it("classifies the distance between cities", () => {
    const s = fresh();
    const { loc, srv } = datacenter(s);
    const kind = (city: string) => {
      const t = structuredClone(s);
      t.locations = t.locations.map((l) => (l.id === loc ? { ...l, city } : l));
      return pathTo(t, deskRouter(t)!, srv)!.map((h) => h.kind).find((k) => ["domestic", "european", "overseas"].includes(k));
    };
    expect(kind("Frankfurt")).toBeUndefined();
    expect(kind("Berlin")).toBe("domestic");
    expect(kind("Amsterdam")).toBe("european");
    expect(kind("New York")).toBe("overseas");
  });

  it("adds delay and loss to a line above 80% of its capacity", () => {
    const s = fresh();
    s.homeLine = { id: "dsl-16", next: null };
    const line: Hop = { kind: "line", name: "line", location: "loc1" };
    expect(latency(s, [line])).toEqual({ ms: [18], loss: 0 });
    for (let i = 0; i < 12; i++) {
      const c = addCustomer(s, `C${i}`, "onlineShop");
      const id = addService(s, c, "vps", `vps ${i}`, 10, "hour", 0, "fra1", sizeSpec("vps", 1, 2005));
      s.workloads.push({ id: `wx${i}`, serviceId: id, clusterId: null, deviceId: null, rackId: null, slot: 0, units: 0, watts: 0, placedAt: 0, vcpu: 1, ramGb: 1, diskGb: 10, stopped: false, busyUntil: 0, backupAt: null });
    }
    s.hour = 20;
    const load = loadOf(s, route(s), "loc1");
    expect(load).toBeGreaterThan(QUEUEING.knee);
    const slow = latency(s, [line]);
    expect(slow.ms[0]).toBeCloseTo(18 + (load - QUEUEING.knee) * QUEUEING.delayMs, 6);
    expect(slow.loss).toBeCloseTo((load - QUEUEING.knee) * QUEUEING.lossPerUnit, 6);
  });
});

describe("terminal", () => {
  it("opens a session on a responsive server", () => {
    const s = fresh();
    const r = runCommand(s, null, `ssh ${host(s)}`);
    expect(r.session).toEqual({ host: host(s), deviceId: "dev3" });
    expect(runCommand(s, null, `ssh root@${host(s)}.${s.company.domain}`).session).toBeTruthy();
  });

  it("refuses ssh to a hung or unreachable server and to an unknown name", () => {
    const hung = fresh();
    dev(hung, "dev3").hung = true;
    expect(out(hung, null, `ssh ${host(hung)}`)).toBe(`ssh: connect to host ${host(hung)} port 22: Connection timed out`);
    expect(runCommand(hung, null, `ssh ${host(hung)}`).session).toBeUndefined();
    const cut = fresh();
    dev(cut, "dev4").on = false;
    expect(out(cut, null, `ssh ${host(cut)}`)).toContain("Connection timed out");
    const off = fresh();
    dev(off, "dev3").on = false;
    expect(out(off, null, `ssh ${host(off)}`)).toContain("Connection timed out");
    expect(out(fresh(), null, "ssh nowhere")).toBe("ssh: Could not resolve hostname nowhere: Name or service not known");
  });

  it("pings with jitter and a statistics line", () => {
    const s = fresh();
    const text = out(s, null, `ping ${host(s)}`);
    expect(text).toContain("4 packets transmitted, 4 received, 0% packet loss");
    const times = [...text.matchAll(/time=([\d.]+) ms/g)].map((m) => Number(m[1]));
    expect(times).toHaveLength(4);
    for (const t of times) expect(Math.abs(t - 1.2)).toBeLessThanOrEqual(1.2 * 0.1 + 0.05);
    expect(out(s, null, `ping ${host(s)}`)).toBe(text);
    expect(runCommand(s, null, `ping ${host(s)}`, 1).output.join("\n")).not.toBe(text);
  });

  it("loses every packet to a hung server and past a stopped switch", () => {
    const hung = fresh();
    dev(hung, "dev3").hung = true;
    expect(out(hung, null, `ping ${host(hung)}`)).toContain("4 packets transmitted, 0 received, 100% packet loss");
    const cut = fresh();
    dev(cut, "dev4").on = false;
    expect(out(cut, null, `ping ${host(cut)}`)).toContain("100% packet loss");
  });

  it("traces every hop and ends at the host", () => {
    const s = fresh();
    const lines = out(s, null, `traceroute ${host(s)}`).split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^ 1  \S+  [\d.]+ ms  [\d.]+ ms  [\d.]+ ms$/);
    expect(lines[3]).toContain(`${host(s)}.${s.company.domain} (192.168.1.`);
  });

  it("stops the trace at the last working hop when a switch is powered off", () => {
    const s = fresh();
    dev(s, "dev4").on = false;
    const lines = out(s, null, `traceroute ${host(s)}`).split("\n");
    expect(lines.slice(1)).toEqual([expect.stringMatching(/^ 1  \S+  [\d.]+ ms/), " 2  * * *", " 3  * * *"]);
  });

  it("stops the trace at the home router when the line is gone", () => {
    const s = fresh();
    const { srv } = datacenter(s);
    s.homeLine = { id: "", next: null };
    const lines = out(s, null, `traceroute ${s.devices.find((d) => d.id === srv)!.hostname}`).split("\n");
    expect(lines[1]).toMatch(/^ 1  \S+  /);
    expect(lines.slice(2).every((l) => l.endsWith("* * *"))).toBe(true);
    expect(lines.length).toBeGreaterThan(3);
  });

  it("prints the address of a name", () => {
    const s = fresh();
    expect(out(s, null, `host ${host(s)}`)).toMatch(/^node001\.\S+ has address 192\.168\.1\.\d+/);
    expect(out(s, null, "host nowhere")).toBe("Host nowhere not found: 3(NXDOMAIN)");
  });

  it("prints a shell error for unknown commands and keeps desk and server commands apart", () => {
    const s = fresh();
    expect(out(s, null, "frobnicate now")).toBe("bash: frobnicate: command not found");
    expect(out(s, null, "top")).toBe("bash: top: command not found");
    const session = login(s);
    expect(out(s, session, "ping x")).toBe("bash: ping: command not found");
    expect(out(s, null, "help")).toContain("traceroute");
    expect(out(s, session, "help")).toContain("recover");
    expect(runCommand(s, null, "clear").clear).toBe(true);
  });

  it("shows the server's usage inside a session", () => {
    const s = fresh();
    const session = login(s);
    expect(out(s, session, "uptime")).toMatch(/up .*load average: [\d.]+, [\d.]+, [\d.]+/);
    expect(out(s, session, "df -h")).toContain("Filesystem");
    expect(out(s, session, "free -m")).toMatch(/Mem:\s+\d+/);
    const top = out(s, session, "top");
    expect(top).toContain("%Cpu(s)");
    expect(top).toContain("vm001");
  });

  it("shuts the server down and ends the session", () => {
    const s = fresh();
    const session = login(s);
    expect(out(s, session, "shutdown")).toBe("usage: shutdown -h now");
    const r = runCommand(s, session, "shutdown -h now");
    expect(r.session).toBeNull();
    expect(r.action!(s).ok).toBe(true);
    expect(dev(s, "dev3").on).toBe(false);
    expect(s.workloads.some((w) => w.corrupted)).toBe(false);
  });

  it("reboots through a clean shutdown and boots again", () => {
    const s = fresh();
    const r = runCommand(s, login(s), "reboot");
    expect(r.session).toBeNull();
    expect(r.action!(s).ok).toBe(true);
    expect(dev(s, "dev3").on).toBe(true);
    expect(dev(s, "dev3").bootUntil).toBeGreaterThan(s.hour);
    expect(s.workloads.some((w) => w.corrupted)).toBe(false);
  });

  it("drops the session when the server stops answering", () => {
    const s = fresh();
    const session = login(s);
    dev(s, "dev3").hung = true;
    const r = runCommand(s, session, "uptime");
    expect(r.session).toBeNull();
    expect(r.output.join("\n")).toContain("closed by remote host");
    expect(runCommand(s, login(fresh()), "exit").session).toBeNull();
  });
});

describe("recover", () => {
  // A pulled plug that corrupted the panel VM on the basement server.
  function corrupted() {
    const s = fresh();
    const w = s.workloads.find((x) => x.deviceId === "dev3")!;
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, corrupted: true, noticed: true } : x));
    return { s, w };
  }

  it("repairs a corrupted workload through the command and reports the outcome when it is done", () => {
    const { s, w } = corrupted();
    const session = login(s);
    const r = runCommand(s, session, `recover ${w.hostname}`);
    expect(r.output).toEqual([`recover: ${w.hostname}: repairing filesystem`, `recover: ${w.hostname}: estimated time 30 minutes`]);
    expect(r.action!(s).ok).toBe(true);
    expect(recoveryReport(s, r.watch!)).toBeNull();
    expect(out(s, session, `recover ${w.hostname}`)).toContain("repair already running");
    tick(s);
    const report = recoveryReport(s, r.watch!)!.join("\n");
    const now = s.workloads.find((x) => x.id === w.id)!;
    expect(report).toBe(now.corrupted ? `recover: ${w.hostname}: repair failed, restore from backup` : `recover: ${w.hostname}: data recovered, service started`);
  });

  it("repairs a web space through the panel VM it runs in", () => {
    const { s, w } = corrupted();
    const space = s.workloads.find((x) => !x.deviceId && x.hostname)!;
    const r = runCommand(s, login(s), `recover ${space.hostname}.${s.company.domain}`);
    expect(r.watch).toEqual({ workloadId: w.id, host: `${space.hostname}.${s.company.domain}` });
    expect(r.action!(s).ok).toBe(true);
  });

  it("explains a service that is clean, unknown or beyond repair", () => {
    const { s, w } = corrupted();
    const session = login(s);
    expect(out(s, session, "recover")).toBe("usage: recover <service hostname>");
    expect(out(s, session, "recover nothing")).toBe("recover: nothing: no such service on this host");
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, recoverFailed: true } : x));
    expect(out(s, session, `recover ${w.hostname}`)).toBe(`recover: ${w.hostname}: unrecoverable, restore from backup`);
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, corrupted: false, recoverFailed: false } : x));
    expect(out(s, session, `recover ${w.hostname}`)).toBe(`recover: ${w.hostname}: filesystem is clean`);
  });

  it("is run by a hired technician with the rule on, and left alone with it off", () => {
    const run = (rule: boolean) => {
      const { s, w } = corrupted();
      const c = visibleCandidates(s).find((x) => x.role === "technician")!;
      const id = must(hire(s, c.id));
      s.staff = s.staff.map((e) => (e.id === id ? { ...e, trained: ["hardware", "servers", "panels"] } : e));
      must(setTechRules(s, { recover: rule }));
      s.hour = 48 + 9 - 1;
      for (let h = 0; h < 6; h++) tick(s);
      return s.workloads.find((x) => x.id === w.id)!;
    };
    const on = run(true);
    expect(on.recoverDoneAt !== undefined || on.recoverFailed || !on.corrupted).toBe(true);
    const off = run(false);
    expect(off.corrupted).toBe(true);
    expect(off.recoverDoneAt).toBeUndefined();
    expect(base.techRules.recover).toBe(true);
  });
});

describe("tab completion", () => {
  it("completes commands, a unique host, and lists ambiguous hosts", () => {
    const s = fresh();
    expect(complete(s, null, "tr").line).toBe("traceroute ");
    expect(complete(s, login(s), "reb").line).toBe("reboot ");
    const name = host(s);
    expect(complete(s, null, `ssh ${name.slice(0, -1)}`).line).toBe(`ssh ${name} `);
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, hostname: "node010" } : d));
    s.devices.push({ ...dev(s, "dev3"), id: "devX", hostname: "node011" });
    expect(complete(s, null, "ssh n").line).toBe("ssh node01");
    expect(complete(s, null, "ssh node01").options).toEqual(["node010", "node011"]);
    expect(complete(s, null, "ssh zz")).toEqual({ line: "ssh zz", options: [] });
  });
});
