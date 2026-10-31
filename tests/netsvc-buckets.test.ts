import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { isMonthStart } from "../src/sim/00-core/time";
import { serviceOnline } from "../src/sim/40-support/status";
import { netsvcTick } from "../src/sim/60-infra/netsvc";
import { bucketsOf } from "../src/sim/60-infra/netsvc-storage";
import { setBucketPolicy } from "../src/sim/90-actions/netsvc-storage";
import { closeTicket } from "../src/sim/90-actions/support";
import { storageGame } from "./storage-game";
import { createTicket } from "../src/sim/40-support/tickets";

void serviceOnline; void sizeSpec;

describe("buckets", () => {
  it("derives one private bucket until a policy changes", () => {
    const { s, v } = storageGame("minnio");
    expect(s.netsvc.buckets).toEqual({});
    const list = bucketsOf(s, v());
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "b1", policy: "private" });
    expect(setBucketPolicy(s, v().id, "b1", "readonly").ok).toBe(true);
    expect(bucketsOf(s, v())[0].policy).toBe("readonly");
    expect(setBucketPolicy(s, v().id, "nope", "public").ok).toBe(false);
  });

  it("gives happiness for approving a public bucket and costs a little to close it", () => {
    const { s, customer, v, happy } = storageGame("minnio");
    createTicket(s, customer(), "howTo", v().id, "bucketPublic");
    const before = happy();
    setBucketPolicy(s, v().id, "b1", "public");
    expect(happy()).toBe(Math.min(100, before + 3));
    expect(s.tickets.find((t) => t.topic === "bucketPublic")!.status).toBe("resolved");
    const open = happy();
    setBucketPolicy(s, v().id, "b1", "private");
    expect(happy()).toBe(open - 1);
  });

  it("costs happiness to decline a public request", () => {
    const { s, customer, v, happy } = storageGame("minnio");
    const t = createTicket(s, customer(), "howTo", v().id, "bucketPublic");
    const before = happy();
    closeTicket(s, t.id);
    expect(happy()).toBe(before - 2);
  });

  it("exposes a public bucket now and then for 25 happiness", () => {
    const { s, v, happy } = storageGame("minnio");
    setBucketPolicy(s, v().id, "b1", "public");
    let events = 0, lost = 0;
    for (let m = 0; m < 300; m++) {
      s.hour += 24;
      while (!isMonthStart(s.hour)) s.hour += 24;
      const before = happy();
      events += netsvcTick(s).filter((e) => e.key === "event.bucketExposed").length;
      if (happy() < before) lost += before - happy();
    }
    expect(events).toBeGreaterThan(0);
    expect(lost).toBeGreaterThanOrEqual(25);
  });

  it("round trips through a save", async () => {
    const { s, v } = storageGame("minnio");
    setBucketPolicy(s, v().id, "b1", "public");
    const { serialize, deserialize } = await import("../src/sim/91-save/save");
    expect(bucketsOf(deserialize(serialize(s)), v())[0].policy).toBe("public");
  });
});
