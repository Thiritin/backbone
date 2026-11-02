import { describe, expect, it } from "vitest";
import { vpsPlanGb } from "../src/sim/10-catalog/economy";
import { footprint, softwareById } from "../src/sim/10-catalog/platforms";
import type { GameState } from "../src/sim/50-state";
import { controlPlaneUse, controlPlanesOn, mailboxesOn, vmRoom } from "../src/sim/60-infra/cluster";
import { selfHosted } from "./company-mail.helpers";
import { readyGame, skipTo } from "./fixtures";

const at = (id: string, year: number) => footprint(softwareById(id), year);
const res = (vcpu: number, ramGb: number, diskGb: number) => ({ vcpu, ramGb, diskGb });

// Puts n company mailboxes on the mail server clusterId in a self-hosted tenant.
function boxes(s: GameState, clusterId: string, n: number): void {
  const tenant = { ...s.mail.tenants[0], id: "tnSelf", host: "self", clusterId };
  const box = s.mail.accounts[0];
  s.mail = { ...s.mail, tenants: [...s.mail.tenants, tenant], accounts: [...s.mail.accounts, ...Array.from({ length: n }, (_, i) => ({ ...box, id: `mbSelf${i}`, tenant: tenant.id }))] };
}

describe("software footprints", () => {
  it("keeps the mail stack small and flat over the years", () => {
    for (const year of [2005, 2026]) {
      expect(at("postfixit", year)).toEqual(res(0.1, 0.25, 2));
      expect(at("squirrelmeal", year)).toEqual(res(0.05, 0.1, 0.1));
      expect(at("postfixitadmin", year)).toEqual(res(0.05, 0.1, 0.5));
    }
    expect(at("mailpig", 2026)).toEqual(res(1, 2, 20));
  });

  it("gives the heavy panels and VM managers realistic first-year sizes", () => {
    expect(at("cpanic", 2005)).toEqual(res(0.5, 1, 10));
    expect(at("hypervee", 2008)).toEqual(res(1, 2, 32));
    expect(at("openstash", 2010)).toEqual(res(4, 8, 50));
    expect(at("veeham", 2026)).toEqual(res(2, 4, 60));
  });

  it("grows a panel's RAM and disk with the square root of server RAM since its first year", () => {
    expect(at("cpanic", 2026)).toEqual(res(0.5, 2.83, 28));
    expect(at("openstash", 2017)).toEqual(res(4, 11.31, 71));
    expect(at("tcadmen", 2026)).toEqual(at("tcadmen", 2005));
    const s = readyGame(3), host = s.clusters.find((c) => c.vm)!, node = s.clusters.find((c) => c.platform)!;
    const before = controlPlaneUse(s, host), hv = controlPlanesOn(s, node.controlPlane!), room = vmRoom(s, host).cap.ramGb;
    skipTo(s, 2026);
    expect(controlPlaneUse(s, host).ramGb).toBeCloseTo(before.ramGb * Math.sqrt(8), 2);
    expect(controlPlaneUse(s, host).vcpu).toBe(before.vcpu);
    expect(controlPlanesOn(s, node.controlPlane!).diskGb).toBeGreaterThan(hv.diskGb);
    expect(vmRoom(s, host).cap.ramGb).toBeLessThan(room);
  });

  it("books disk for every company mailbox on the mail server, growing with server RAM", () => {
    const s = readyGame(5), id = selfHosted(s), c = s.clusters.find((x) => x.id === id)!;
    expect(controlPlaneUse(s, c).diskGb).toBe(2 + mailboxesOn(s, id) * vpsPlanGb(2005));
    const free = vmRoom(s, c).cap.diskGb, held = mailboxesOn(s, id);
    boxes(s, id, 3);
    expect(mailboxesOn(s, id)).toBe(held + 3);
    expect(vmRoom(s, c).cap.diskGb).toBeCloseTo(free - 3, 9);
    skipTo(s, 2026);
    expect(controlPlaneUse(s, c)).toEqual(res(0.1, 0.25, 2 + (held + 3) * 8));
  });
});
