import { describe, expect, it } from "vitest";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { subjectParams } from "../src/sim/40-support/notices";
import { isFinal } from "../src/sim/40-support/tickets";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { noticeEnd } from "../src/sim/90-actions/hardware";
import { terminateService } from "../src/sim/90-actions/holds";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { t } from "../src/i18n/en";
import { panelVm, readyGame } from "./fixtures";

function setup() {
  const s = readyGame(3);
  panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const mk = (label: string) => { const r = provisionService(s, cus, "webHosting", { label }); if (!r.ok) throw new Error(r.error); return r.id!; };
  const a = mk("a.com"), b = mk("b.com");
  const email = (id: string) => s.tickets.filter((x) => x.serviceId === id && x.topic === "byHost");
  return { s, cus, a, b, svc: (id: string) => s.services.find((v) => v.id === id)!, email };
}

describe("host termination", () => {
  it("keeps a noticed service running until its end date, then the tick ends it", () => {
    const { s, a, b, svc, email } = setup();
    const end = noticeEnd(s.hour, 1);
    expect(terminateService(s, a, "notice", null).ok).toBe(true);
    expect(svc(a).endsAt).toBe(end);
    expect(svc(a).endedAt).toBeNull();
    expect(terminateService(s, a, "notice", "usage")).toEqual({ ok: false, error: "error.alreadyNoticed" });
    s.hour = end - 2;
    tick(s);
    expect(svc(a).endedAt).toBeNull();
    while (s.hour <= end) tick(s);
    expect(svc(a).endedAt).toBe(end);
    expect(workloadsOf(s, a)).toHaveLength(0);
    expect(svc(b).endedAt).toBeNull();
    expect(email(a)).toHaveLength(1);
  });

  it("needs a reason to end a service immediately", () => {
    const { s, a, svc, email } = setup();
    expect(terminateService(s, a, "now", null)).toEqual({ ok: false, error: "error.terminateReason" });
    expect(svc(a).endedAt).toBeNull();
    expect(email(a)).toHaveLength(0);
    expect(terminateService(s, a, "now", "capacity").ok).toBe(true);
    expect(svc(a).endedAt).toBe(s.hour);
    expect(workloadsOf(s, a)).toHaveLength(0);
  });

  it("emails the customer a closed notice with the end date and reason", () => {
    const { s, cus, a, b, email } = setup();
    const happy = s.customers.find((c) => c.id === cus)!.happiness;
    terminateService(s, a, "notice", "abuse");
    terminateService(s, b, "now", "payment");
    const [na] = email(a), [nb] = email(b);
    expect(na.customerId).toBe(cus);
    expect(na.kind).toBe("cancellation");
    expect(isFinal(na) && isFinal(nb)).toBe(true);
    expect(na.term).toEqual({ end: noticeEnd(s.hour, 1), now: false, reason: "abuse" });
    expect(nb.term).toEqual({ end: s.hour, now: true, reason: "payment" });
    expect(t("ticket.cancellation.byHost.text", subjectParams(s, na))).toContain("Reason: Abuse.");
    expect(t("ticket.cancellation.byHost.text", subjectParams(s, nb))).toContain("immediate effect");
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBeLessThan(happy);
  });

  it("loads a save that still lists held customers and keeps a notice", () => {
    const { s, a, cus, svc } = setup();
    terminateService(s, a, "notice", null);
    const raw = JSON.parse(serialize(s));
    raw.heldCustomers = [cus];
    const back = deserialize(JSON.stringify(raw));
    expect("heldCustomers" in back).toBe(false);
    expect(back.services.find((v) => v.id === a)!.endsAt).toBe(svc(a).endsAt);
  });
});
