import { describe, expect, it } from "vitest";
import { fqdn } from "../src/sim/30-customers/domains";
import { consoleBookmarks, consoleFeatures } from "../src/sim/80-business/consoles";
import { resolve } from "../src/sim/80-business/browser";
import type { GameState } from "../src/sim/50-state";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice, bootedMachine } from "./fixtures";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { installSoftware } from "../src/sim/90-actions/software";
import { readyGame, panelServer } from "./fixtures";
import { mountDevice } from "./plugged";

const must = (r: { ok: boolean; id?: string; error?: string }): string => { if (!r.ok) throw new Error(r.error); return r.id!; };
const at = (id: string, year: number) => consoleFeatures(id, year);

describe("console feature matrix", () => {
  it("gives every panel the list, stop, start, create, delete and update rows", () => {
    for (const id of ["cpanic", "pleskit", "directadmen", "freepanel", "openstash", "vmwhere", "proxmocks", "hypervee", "openveezee"]) {
      expect(at(id, 2026)).toMatchObject({ create: true, delete: true, stop: true, start: true, update: true });
    }
  });

  it("migrates panels from the year their tool imports from another panel", () => {
    expect(at("cpanic", 2011).migrate).toBeNull();
    expect(at("cpanic", 2012).migrate).toBe("hand");
    expect(at("pleskit", 2014).migrate).toBeNull();
    expect(at("pleskit", 2015).migrate).toBe("hand");
    for (const id of ["directadmen", "freepanel"]) expect(at(id, 2026).migrate).toBeNull();
  });

  it("migrates hypervisors live, except HyperVee and OpenVeeZee, which move cold", () => {
    for (const id of ["openstash", "vmwhere", "proxmocks"]) expect(at(id, 2026).migrate).toBe("live");
    for (const id of ["hypervee", "openveezee"]) expect(at(id, 2026).migrate).toBe("cold");
    expect(at("openstash", 2009).migrate).toBeNull();
  });

  it("leaves FreePanel without resize and backups, and HyperVee and Horizont without backups", () => {
    expect(at("freepanel", 2026)).toMatchObject({ resize: false, backups: false });
    for (const id of ["cpanic", "pleskit", "directadmen"]) expect(at(id, 2026)).toMatchObject({ resize: true, backups: true });
    for (const id of ["openstash", "hypervee"]) expect(at(id, 2026)).toMatchObject({ resize: true, backups: false });
    for (const id of ["vmwhere", "proxmocks"]) expect(at(id, 2026)).toMatchObject({ resize: true, backups: true });
  });

  it("takes sites offline and cleans up only on panels and game panels", () => {
    for (const id of ["cpanic", "pleskit", "directadmen", "freepanel", "tcadmen", "multikraft", "pterodaktyl"]) expect(at(id, 2026)).toMatchObject({ sitesOffline: true, cleanUp: true });
    for (const id of ["openstash", "vmwhere", "proxmocks", "hypervee"]) expect(at(id, 2026)).toMatchObject({ sitesOffline: false, cleanUp: false });
  });

  it("shows the cluster view from the software's cluster year", () => {
    expect(at("freepanel", 2008).cluster).toBe(false);
    expect(at("freepanel", 2009).cluster).toBe(true);
    expect(at("hypervee", 2011).cluster).toBe(false);
    expect(at("hypervee", 2012).cluster).toBe(true);
    for (const id of ["cpanic", "pleskit", "directadmen", "tcadmen", "postfixit"]) expect(at(id, 2026).cluster).toBe(false);
    for (const id of ["openstash", "vmwhere", "proxmocks"]) expect(at(id, 2026).cluster).toBe(true);
  });

  it("restores game servers only on Pterodaktyl and gives mail no object actions", () => {
    expect(at("pterodaktyl", 2026).backups).toBe(true);
    expect(at("tcadmen", 2026).backups).toBe(false);
    expect(at("multikraft", 2026).look).toBe("game");
    expect(at("postfixit", 2026)).toMatchObject({ look: "mail", stop: false, create: false, migrate: null, update: true });
  });
});

// The starting game has a Proxmocks node and a FreePanel VM; this adds a bare-metal Pleskit host and a mail VM.
function lab() {
  const s: GameState = readyGame(1);
  s.cash = 100_000;
  const dev = must(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  expect(mountDevice(s, dev, "rack2", 2)).toMatchObject({ ok: true });
  expect(connect(s, { device: dev, port: 0 }, { device: "dev4", port: 1 }).ok).toBe(true);
  const barePanel = panelServer(s, dev, "pleskit");
  const mailVm = bootedMachine(s, must(createVm(s, s.clusters[0].id, PANEL_VM_SIZE)));
  expect(installSoftware(s, mailVm, "postfixit").ok).toBe(true);
  s.clusters = s.clusters.map((c) => (c.vm === mailVm ? { ...c, panel: "postfixit", switching: null } : c));
  return { s, bare: dev, barePanel, mailVm };
}

describe("console resolution", () => {
  it("resolves a node, a panel VM, a bare-metal panel and a mail VM to their console", () => {
    const { s, bare, barePanel, mailVm } = lab(), node = s.devices.find((d) => d.id === "dev3")!, bareDev = s.devices.find((d) => d.id === bare)!;
    const panelVm = s.workloads.find((w) => !w.serviceId && s.clusters.some((c) => c.vm === w.id && c.panel === "freepanel"))!;
    const hypervisor = s.clusters.find((c) => c.platform)!;
    expect(resolve(s, fqdn(s, node.hostname!)).page).toEqual({ kind: "console", hostname: node.hostname, clusterId: hypervisor.id, defaced: false });
    expect(resolve(s, fqdn(s, panelVm.hostname!)).page).toMatchObject({ kind: "console", defaced: false });
    expect(resolve(s, fqdn(s, bareDev.hostname!)).page).toEqual({ kind: "console", hostname: bareDev.hostname, clusterId: barePanel, defaced: false });
    const mail = s.workloads.find((w) => w.id === mailVm)!;
    expect(resolve(s, fqdn(s, mail.hostname!)).page).toMatchObject({ kind: "console", clusterId: s.clusters.find((c) => c.vm === mailVm)!.id });
  });

  it("serves no console on a machine without software", () => {
    const { s } = lab(), empty = must(createVm(s, s.clusters[0].id, PANEL_VM_SIZE)), vm = s.workloads.find((w) => w.id === empty)!;
    expect(resolve(s, fqdn(s, vm.hostname!)).page).toEqual({ kind: "host", hostname: vm.hostname });
  });

  it("cannot reach a console on a host that is down", () => {
    const { s, bare } = lab(), bareDev = s.devices.find((d) => d.id === bare)!;
    expect(resolve(s, fqdn(s, bareDev.hostname!)).load).toBe("fast");
    expect(setPower(s, bare, false).ok).toBe(true);
    expect(resolve(s, fqdn(s, bareDev.hostname!)).load).toBe("down");
    const node = s.devices.find((d) => d.id === "dev3")!, panelVm = s.workloads.find((w) => s.clusters.some((c) => c.vm === w.id && c.panel === "freepanel"))!;
    expect(setPower(s, node.id, false).ok).toBe(true);
    expect(resolve(s, fqdn(s, node.hostname!)).load).toBe("down");
    expect(resolve(s, fqdn(s, panelVm.hostname!)).load).toBe("down");
  });

  it("defaces the login page of a hacked host and no other", () => {
    const { s, bare, barePanel } = lab(), bareDev = s.devices.find((d) => d.id === bare)!, node = s.devices.find((d) => d.id === "dev3")!;
    s.security = { ...s.security, hacked: [barePanel] };
    expect(resolve(s, fqdn(s, bareDev.hostname!)).page).toMatchObject({ kind: "console", defaced: true });
    expect(resolve(s, fqdn(s, node.hostname!)).page).toMatchObject({ kind: "console", defaced: false });
  });

  it("lists every console the company runs", () => {
    const { s } = lab(), marks = consoleBookmarks(s);
    expect(marks.length).toBe(s.clusters.length);
    for (const m of marks) expect(resolve(s, m.url).page.kind).toBe("console");
  });
});
