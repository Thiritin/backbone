import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { modelById, OOB_PORT, oobPorts, shopModels } from "../src/sim/10-catalog/hardware";
import { DATACENTERS, datacenterById } from "../src/sim/20-world/datacenters";
import { device, type GameState } from "../src/sim/50-state";
import { addressOf } from "../src/sim/60-infra/lan";
import { networkBills } from "../src/sim/60-infra/network";
import { consoleVia, exposedDevices, firmwareVulns, GEAR_RECOVER_HOURS, kvmPower, oobSecurityTick, oobUp } from "../src/sim/60-infra/oob";
import { hardReboot, powerTick, STUCK_CHANCE } from "../src/sim/60-infra/power";
import { deviceHealth, linkStatus, working } from "../src/sim/60-infra/status";
import { runCommand } from "../src/sim/60-infra/terminal";
import { resolve } from "../src/sim/80-business/browser";
import { connect, remotePower, reset, setPortGroup, setPower } from "../src/sim/90-actions/hardware";
import { continueBoot, fitAtx, recoverGear, setUplink, updateFirmware } from "../src/sim/90-actions/remote";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

// readyGame: dev3 a G1 Dwell server on dev4 (sw-8) port 0, dev4 port 7 on the home router dev5, all in rack2.
const at = (year: number): GameState => {
  const s = readyGame(12);
  s.hour = Math.max(s.hour, hourOf(new Date(Date.UTC(year, 0, 1, 9))));
  return s;
};
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const add = (s: GameState, id: string, model: string, brand: string, slot: number) => {
  s.devices.push(device(id, model, brand, "rack2", slot, null, `fra1-${id}`, modelById(model).price));
  return dev(s, id);
};
const err = (r: object) => (r as { error?: string }).error;
const must = (r: { ok: boolean }) => { expect(err(r)).toBeUndefined(); expect(r.ok).toBe(true); };
const oob = (s: GameState, id: string, kind: string, n = 0) => OOB_PORT + oobPorts(modelById(dev(s, id).model)).map((p, i) => [p, i] as const).filter(([p]) => p === kind)[n][1];
const cable = (s: GameState, a: string, ap: number, b: string, bp: number) => must(connect(s, { device: a, port: ap }, { device: b, port: bp }));
// The location becomes a datacenter, so hand work goes to remote hands.
const inDc = (s: GameState) => { s.locations[0].dc = DATACENTERS[0].id; return datacenterById(DATACENTERS[0].id).remoteHands; };
// A PiKVN on the data switch, its output on the server's console end.
const piKvn = (s: GameState) => {
  add(s, "dev90", "pikvn", "Pear Street Electronics", 2);
  cable(s, "dev90", oob(s, "dev90", "net"), "dev4", 1);
  cable(s, "dev90", oob(s, "dev90", "kvm"), "dev3", oob(s, "dev3", "console"));
};
// An OOB switch with its own DSL line and an OpenGearbox 8 behind it, its first serial port on the switch's console port.
const consoleServer = (s: GameState) => {
  add(s, "dev91", "oob-8", "Rarytan", 3);
  add(s, "dev92", "ogb-8", "OpenGearbox", 4);
  must(setUplink(s, "dev91", "dsl"));
  cable(s, "dev92", oob(s, "dev92", "net"), "dev91", oob(s, "dev91", "net"));
  cable(s, "dev92", oob(s, "dev92", "serial"), "dev4", oob(s, "dev4", "console"));
};

describe("remote access catalog", () => {
  it("sells the KVMs, console servers and the OOB switch by year", () => {
    const ids = (y: number) => shopModels(y).map((m) => m.id);
    expect(ids(2005)).toEqual(expect.arrayContaining(["ipkvn-8", "ogb-8", "ogb-16", "ogb-48", "oob-8"]));
    expect(ids(2018)).not.toContain("pikvn");
    expect(ids(2019)).toContain("pikvn");
    expect([modelById("pikvn").price, modelById("pikvn").height, modelById("ipkvn-8").price, modelById("ogb-16").price, modelById("oob-8").price]).toEqual([60, 0, 1200, 2500, 150]);
    expect(oobPorts(modelById("g1-compute"))).toEqual(["console"]);
    expect(oobPorts(modelById("sw-24"))).toEqual(["mgmt", "console"]);
    expect(oobPorts(modelById("isr-1841"))).toEqual(["mgmt", "console"]);
    expect(oobPorts(modelById("fw-1g"))).toEqual([]);
  });

  it("cables management ports only to their counterparts and keeps them out of the data path", () => {
    const s = at(2019);
    add(s, "dev90", "pikvn", "Pear Street Electronics", 2);
    expect(err(connect(s, { device: "dev90", port: oob(s, "dev90", "kvm") }, { device: "dev4", port: oob(s, "dev4", "console") }))).toBe("error.mediaMismatch");
    expect(err(connect(s, { device: "dev90", port: oob(s, "dev90", "kvm") }, { device: "dev4", port: 2 }))).toBe("error.mediaMismatch");
    piKvn(s);
    expect(linkStatus(s, "dev3").online).toBe(true);
    expect(oobUp(s, "dev90")).toBe(true);
  });
});

describe("add-on KVMs", () => {
  it("power a G1 server on from afar through a PiKVN", () => {
    const s = at(2019);
    inDc(s);
    must(setPower(s, "dev3", false));
    expect(err(remotePower(s, "dev3", true))).toBe("error.noBmc");
    piKvn(s);
    expect(kvmPower(s, dev(s, "dev3"))?.id).toBe("dev90");
    must(remotePower(s, "dev3", true));
    expect(dev(s, "dev3").on).toBe(true);
    must(reset(s, "dev3"));
  });

  it("give an IP-KVN 8 the console only, and power with an ATX adapter", () => {
    const s = at(2006);
    add(s, "dev93", "ipkvn-8", "Avoscent", 3);
    cable(s, "dev93", oob(s, "dev93", "net"), "dev4", 1);
    cable(s, "dev93", oob(s, "dev93", "kvm"), "dev3", oob(s, "dev3", "console"));
    expect(consoleVia(s, "dev3")?.kind).toBe("kvm");
    expect(err(remotePower(s, "dev3", false))).toBe("error.noBmc");
    const cash = s.cash;
    must(fitAtx(s, "dev3"));
    expect(s.cash).toBe(cash - 25);
    must(remotePower(s, "dev3", false));
  });

  it("fail at 4% a year and show a plain KVM page in the browser", async () => {
    const { failureChance } = await import("../src/sim/88-tick/tick");
    const s = at(2019);
    piKvn(s);
    const kvm = dev(s, "dev90");
    expect(failureChance(s, kvm, kvm.components[0]) * 8760).toBeCloseTo(0.04);
    const ip = addressOf(s, "dev90");
    expect(resolve(s, `http://${ip}/`)).toMatchObject({ page: { kind: "kvm", deviceId: "dev90" }, load: "fast" });
    kvm.on = false;
    expect(resolve(s, `http://${ip}/`).load).toBe("down");
  });
});

describe("stuck boot", () => {
  it("sticks about 5% of hard restarts in a datacenter and never in the basement", () => {
    const home = at(2006);
    for (let h = 0; h < 200; h++) { const d = dev(home, "dev3"); d.stuck = false; home.hour += 1; hardReboot(home, d, "ipmi.log.reset"); expect(d.stuck).toBe(false); }
    const s = at(2006);
    // The roll only runs in a datacenter: treat the basement as one for the count.
    s.locations[0].dc = DATACENTERS[0].id;
    let stuck = 0;
    for (let h = 0; h < 2000; h++) {
      const d = dev(s, "dev3");
      d.stuck = false;
      s.hour += 1;
      hardReboot(s, d, "ipmi.log.reset");
      if (d.stuck) stuck++;
    }
    expect(stuck / 2000).toBeGreaterThan(STUCK_CHANCE / 2);
    expect(stuck / 2000).toBeLessThan(STUCK_CHANCE * 2);
  });

  it("clears over a console in 2 minutes and waits for hands without one", () => {
    const stuckGame = () => {
      const s = at(2019);
      const hands = inDc(s);
      const d = dev(s, "dev3");
      d.stuck = true;
      d.bootUntil = s.hour;
      expect(working(s, "dev3")).toBe(false);
      expect(deviceHealth(s, "dev3").state).toBe("stuck");
      return { s, hands };
    };
    const { s, hands } = stuckGame();
    const cash = s.cash;
    must(continueBoot(s, "dev3"));
    expect(dev(s, "dev3").stuck).toBe(true);
    expect(dev(s, "dev3").hands).toEqual({ kind: "continue", doneAt: s.hour + hands.responseHours + 2 / 60 });
    expect(s.cash).toBe(cash - hands.perHour);
    s.hour = dev(s, "dev3").hands!.doneAt;
    powerTick(s);
    expect(working(s, "dev3")).toBe(true);

    const k = stuckGame().s;
    piKvn(k);
    expect(runCommand(k, null, "console fra1-srv-01").output.join("\n")).toContain("Press F1 to continue");
    must(continueBoot(k, "dev3"));
    expect(dev(k, "dev3").stuck).toBe(false);
    k.hour += 2 / 60;
    expect(working(k, "dev3")).toBe(true);
  });
});

describe("out-of-band management", () => {
  const hungSwitch = () => {
    const s = at(2008);
    const hands = inDc(s);
    dev(s, "dev4").hung = true;
    expect(linkStatus(s, "dev3").online).toBe(false);
    return { s, hands };
  };

  it("recovers a hung switch in 5 minutes over a console server", () => {
    const { s } = hungSwitch();
    consoleServer(s);
    expect(consoleVia(s, "dev4")?.device.id).toBe("dev92");
    must(recoverGear(s, "dev4"));
    expect(dev(s, "dev4").hands ?? null).toBeNull();
    expect(working(s, "dev4")).toBe(false);
    s.hour += GEAR_RECOVER_HOURS;
    expect(working(s, "dev4")).toBe(true);
    expect(linkStatus(s, "dev3").online).toBe(true);
  });

  it("waits for remote hands without a console path", () => {
    const { s, hands } = hungSwitch();
    must(recoverGear(s, "dev4"));
    const doneAt = s.hour + hands.responseHours + GEAR_RECOVER_HOURS;
    expect(dev(s, "dev4").hands).toEqual({ kind: "recover", doneAt });
    s.hour = Math.ceil(doneAt) - 1;
    powerTick(s);
    expect(working(s, "dev4")).toBe(false);
    s.hour = Math.ceil(doneAt);
    powerTick(s);
    expect(working(s, "dev4")).toBe(true);
  });

  it("opens consoles from the Terminal while the data network is down", () => {
    const { s } = hungSwitch();
    consoleServer(s);
    const out = runCommand(s, null, "console fra1-sw-01").output.join("\n");
    expect(out).toContain("through fra1-dev92");
    expect(out).toContain("soft lockup");
    expect(runCommand(s, null, "console fra1-srv-01").output.join("\n")).toContain("no out-of-band path");
  });

  it("hangs a switch on 10% of firmware updates and locks it on 2% of port group changes", () => {
    let hung = 0, locked = 0;
    for (let i = 0; i < 400; i++) {
      const s = at(2008);
      s.hour += i;
      dev(s, "dev4").fw = { version: 2005, updatedAt: 0 };
      must(updateFirmware(s, "dev4"));
      if (dev(s, "dev4").hung) hung++;
      const t = at(2008);
      t.hour += i;
      must(setPortGroup(t, "dev4", [2, 3]));
      if (dev(t, "dev4").locked) locked++;
    }
    expect(hung / 400).toBeGreaterThan(0.05);
    expect(hung / 400).toBeLessThan(0.16);
    expect(locked).toBeGreaterThan(0);
    expect(locked / 400).toBeLessThan(0.06);
    const s = at(2008);
    dev(s, "dev4").fw = { version: 2008, updatedAt: s.hour };
    expect(err(updateFirmware(s, "dev4"))).toBe("error.upToDate");
    dev(s, "dev4").locked = true;
    expect(err(setPortGroup(s, "dev4", [2, 3]))).toBe("error.lockedOut");
  });

  it("bills the management line and the modem monthly", () => {
    const s = at(2008);
    consoleServer(s);
    must(setUplink(s, "dev92", "modem"));
    const lines = networkBills(s).filter((b) => b.key.startsWith("ledger.mgmt"));
    expect(lines.map((b) => b.amount).sort((a, b) => a - b)).toEqual([-30, -20]);
    const old = at(2007);
    add(old, "dev92", "ogb-8", "OpenGearbox", 4);
    expect(err(setUplink(old, "dev92", "modem"))).toBe("error.noModem");
  });
});

describe("exposed management devices", () => {
  it("list a KVM on a data switch and a console server on its own line, not one behind the OOB switch", () => {
    const s = at(2019);
    piKvn(s);
    consoleServer(s);
    expect(exposedDevices(s).map((d) => d.id).sort()).toEqual(["dev90", "dev91"]);
    must(setUplink(s, "dev91", null));
    must(setUplink(s, "dev92", "dsl"));
    expect(exposedDevices(s).map((d) => d.id).sort()).toEqual(["dev90", "dev92"]);
  });

  it("are open to the yearly oob vulnerabilities until the firmware is updated, and an intruder cuts what they hold", () => {
    const s = at(2019);
    piKvn(s);
    const kvm = dev(s, "dev90");
    kvm.fw = { version: 2005, updatedAt: 0 };
    expect(firmwareVulns(s, kvm).length).toBeGreaterThan(5);
    let hits = 0;
    for (let day = 0; day < 400 && !hits; day++) {
      s.hour = Math.ceil(s.hour / 24) * 24 + 24;
      hits = oobSecurityTick(s).filter((e) => e.key === "event.oobHacked").length;
    }
    expect(hits).toBe(1);
    expect(dev(s, "dev3").on).toBe(false);
    must(updateFirmware(s, "dev90"));
    expect(firmwareVulns(s, dev(s, "dev90"))).toEqual([]);
  });
});

describe("old saves", () => {
  it("load with the remote access fields filled", () => {
    const s = at(2019);
    piKvn(s);
    const raw = JSON.parse(serialize(s));
    for (const d of raw.devices) { delete d.stuck; delete d.locked; delete d.fw; }
    const back = deserialize(JSON.stringify(raw));
    expect(dev(back, "dev3")).toMatchObject({ stuck: false, locked: false });
    expect(dev(back, "dev4").fw).toEqual({ version: 2005, updatedAt: 0 });
    expect(dev(back, "dev3").fw).toBeUndefined();
    expect(kvmPower(back, dev(back, "dev3"))?.id).toBe("dev90");
  });
});
