import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { type GameState } from "../src/sim/50-state";
import { hasBackup } from "../src/sim/60-infra/apps";
import { RESTORE_HOURS, STAGE_HOURS, VULNS, securityTick } from "../src/sim/60-infra/security";
import { createVm, installPanelInVm, provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setPower } from "../src/sim/90-actions/hardware";
import { tick } from "../src/sim/88-tick/tick";
import { cleanUp } from "../src/sim/90-actions/security";
import { hypervisor, panelServer, skipTo, withServer, newGame } from "./fixtures";

const ok = (r: ReturnType<typeof setPower>) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const MOPB = VULNS[0];

// A bare-metal panel host with one site, in the hours after the 2007 advisory's mass-scanning warning.
function warned(powered: boolean): GameState {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const host = panelServer(s, "dev3"), cus = addCustomer(s, "Ada Lang", "hobbyDev");
  ok(provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: host }));
  if (!powered) ok(setPower(s, "dev3", false));
  s.security = { ...s.security, vuln: MOPB.id, seen: [MOPB.id], stage: 2 };
  s.hour = MOPB.at + STAGE_HOURS[2];
  for (let h = 0; h < 500 && !s.security.hacked.length; h++) { securityTick(s); s.hour++; }
  return s;
}

// A FreePanel inside a VM on a hypervisor, with one site on it.
function panelInVm() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  skipTo(s, 2012);
  const vm = ok(createVm(s, hypervisor(s, ["dev3"], "Cloud 1"), { vcpu: 1, ramGb: 2, diskGb: 20 }));
  const panel = ok(installPanelInVm(s, vm, "freepanel"));
  for (let h = 0; h < 48 && !s.clusters.find((c) => c.id === panel)!.panel; h++) tick(s);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const svc = ok(provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, 2012), clusterId: panel }));
  const site = () => s.workloads.find((w) => w.serviceId === svc)!;
  return { s, vm, panel, svc, site };
}

describe("compromise reach and clean-up backups", () => {
  it("never compromises a panel host that is switched off", () => {
    expect(warned(true).security.hacked).toHaveLength(1);
    expect(warned(false).security.hacked).toEqual([]);
  });

  it("restores a site from its panel VM's backup", () => {
    const { s, vm, panel, svc, site } = panelInVm();
    expect(hasBackup(s, svc)).toBe(false);
    s.workloads = s.workloads.map((w) => (w.id === vm ? { ...w, backupAt: s.hour } : w));
    expect(site().backupAt).toBeNull();
    expect(hasBackup(s, svc)).toBe(true);
    s.security = { ...s.security, hacked: [panel] };
    ok(cleanUp(s, panel));
    expect(site().busyUntil).toBe(s.hour + RESTORE_HOURS);
  });

  it("counts a site's own backup inside a panel VM", () => {
    const { s, svc, site } = panelInVm();
    s.workloads = s.workloads.map((w) => (w.serviceId === svc ? { ...w, backupAt: s.hour } : w));
    expect(site().backupAt).not.toBeNull();
    expect(hasBackup(s, svc)).toBe(true);
  });
});
