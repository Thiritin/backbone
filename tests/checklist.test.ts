import { routerOnLine, newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { type GameState } from "../src/sim/50-state";
import { CHECKS, checkDone } from "../src/sim/checklist";
import { takeLoan } from "../src/sim/90-actions/billing";
import { toggleCheck } from "../src/sim/90-actions/checklist";
import { skipTo, bootedMachine, registered } from "./fixtures";
import { addLocation, connect } from "../src/sim/90-actions/hardware";
import { buyDevice, settle } from "./fixtures";
import { mountDevice } from "./plugged";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { installSoftware } from "../src/sim/90-actions/software";
import { tick } from "../src/sim/88-tick/tick";
import { signRegistrar } from "../src/sim/90-actions/registrar";
import { stepOf } from "../src/ui/apps/guide";
import { TUTORIAL } from "../src/sim/checklist";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const done = (s: GameState) => Object.keys(CHECKS).filter((id) => checkDone(s, id));

describe("checklist", () => {
  it("starts with nothing done", () => {
    const s = newGame(1);
    expect(s.checklist).toEqual([]);
    expect(done(s)).toEqual([]);
  });

  it("detects a bought and mounted server, the line, a loan, the first and second online server and datacenter space", () => {
    const s = { ...newGame(1), cash: 100_000, homeLine: { id: "", next: null } };
    ok(takeLoan(s, 10_000, 1));
    const [a, b] = [1, 2].map((slot) => {
      const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
      ok(mountDevice(s, srv, "rack2", slot));
      return srv;
    });
    expect(done(s)).toEqual(["buyServer", "mountServer", "loan"]);
    routerOnLine(s);
    ok(connect(s, { device: a, port: 0 }, { device: "dev5", port: 0 }));
    settle(s);
    expect(done(s)).toEqual(["buyServer", "mountServer", "mountRouter", "loan"]);
    s.homeLine = { id: "dsl-16", next: null };
    expect(done(s)).toEqual(["buyServer", "mountServer", "mountRouter", "serverLinked", "loan", "firstServer"]);
    ok(connect(s, { device: b, port: 0 }, { device: "dev5", port: 1 }));
    settle(s);
    expect(done(s)).toEqual(["buyServer", "mountServer", "mountRouter", "serverLinked", "loan", "firstServer", "secondServer"]);
    ok(addLocation(s, "interaction-fra", "share", 1));
    expect(done(s)).toEqual(["buyServer", "mountServer", "mountRouter", "serverLinked", "loan", "firstServer", "secondServer", "datacenter"]);
  });

  it("detects a datacenter cluster that sells", () => {
    const s = { ...newGame(1), cash: 100_000 };
    const loc = ok(addLocation(s, "hetzler-park", "share", 4));
    const srv = ok(buyDevice(s, "g1-storage", "Dwell", 1, loc));
    ok(mountDevice(s, srv, s.racks.find((r) => r.locationId === loc)!.id, 1));
    ok(connect(s, { device: srv, port: 0 }, { device: s.devices.find((d) => d.panel === loc)!.id, port: 0 }));
    for (let h = 0; h < 72; h++) tick(s);
    expect(checkDone(s, "dcCluster")).toBe(false);
    skipTo(s, 2010);
    ok(installSoftware(s, bootedMachine(s, srv), "proxmocks"));
    for (let h = 0; h < 6; h++) tick(s);
    expect(checkDone(s, "dcCluster")).toBe(true);
  });

  it("ticks and unticks goals by hand", () => {
    const s = newGame(1);
    toggleCheck(s, "hire");
    expect(checkDone(s, "hire")).toBe(true);
    toggleCheck(s, "hire");
    expect(checkDone(s, "hire")).toBe(false);
  });

  it("keeps ticks in saves and loads old saves without them", () => {
    const s = newGame(1);
    toggleCheck(s, "exchange");
    expect(deserialize(serialize(s)).checklist).toEqual(["exchange"]);
    const { checklist: _, ...old } = newGame(1);
    expect(deserialize(JSON.stringify(old)).checklist).toEqual([]);
  });

  it("drops the removed Checklist app from an old save's dock", () => {
    const raw = JSON.parse(serialize(registered(newGame(1))));
    delete raw.registration;
    raw.installed = [...raw.installed, "Checklist"];
    const s = deserialize(JSON.stringify(raw));
    expect(s.installed).not.toContain("Checklist");
    expect(s.installed).toContain("Pear Mail");
    expect(newGame(1).installed).not.toContain("Checklist");
  });

  it("names the place of every tutorial step and the partner once a contract exists", () => {
    const s = newGame(1);
    for (const id of TUTORIAL) expect(stepOf(s, id).text).toMatch(/\.$/);
    expect(stepOf(s, "domain").text).toBe("Buy a domain for your company at NameCheep in the Browser.");
    expect(stepOf(s, "domain").focus?.id).toBe("www.namecheep.com/");
    expect(stepOf(s, "website")).toMatchObject({ app: "Shop", focus: { kind: "software", id: "Marketing" } });
    s.installed = [...s.installed, "Marketing"];
    expect(stepOf(s, "website")).toMatchObject({ app: "Marketing", focus: { kind: "page", id: "website" } });
    expect(stepOf(s, "buyServer").focus).toEqual({ kind: "class", id: "server" });
    expect(stepOf(s, "bank").focus?.id).toMatch(/sparklasse/);
    expect(stepOf(s, "email").focus).toEqual({ kind: "url", id: "www.ionose.com/" });
    expect(stepOf(s, "hosttoast").focus).toEqual({ kind: "url", id: "www.hosttoast.de/" });
    expect(stepOf(s, "flyers").focus?.id).toMatch(/flyerlarm\.de\/$/);
    ok(signRegistrar(s, "goDuddy"));
    expect(stepOf(s, "domain").text).toBe("Buy a domain for your company at GoDuddy Reseller in the Browser.");
    expect(stepOf(s, "domain").focus?.id).toMatch(/\/$/);
  });

  it("ticks the HOSTtoast and flyer steps from state", () => {
    const s = newGame(1);
    expect(checkDone(s, "hosttoast") || checkDone(s, "flyers")).toBe(false);
    s.hosttoast = { ...s.hosttoast, tier: "registered" };
    s.marketing = { ...s.marketing, flyers: [{ id: "f1", city: "x", size: 1000, orderedAt: 0, flyersLeft: 1000, leads: 0 }] };
    expect(checkDone(s, "hosttoast") && checkDone(s, "flyers")).toBe(true);
  });

  it("points the server steps at the basement and the first server", () => {
    const s = { ...newGame(1), cash: 100_000 };
    ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    expect(stepOf(s, "mountServer").focus).toEqual({ kind: "location", id: "loc1" });
    expect(stepOf(s, "setup")).toMatchObject({ app: "Terminal", focus: { kind: "ssh" } });
  });
});
