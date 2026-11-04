import { describe, expect, it } from "vitest";
import { partOffers, samePart, specOf } from "../src/sim/10-catalog/hardware";
import { installPart } from "../src/sim/90-actions/hardware";
import { partLabel } from "../src/ui/apps/hw";
import { yearOf } from "../src/sim/00-core/time";
import { buyDevice, newGame, withServer } from "./fixtures";

describe("ordering a replacement part", () => {
  it("keeps the part's family name through order, delivery and install", () => {
    const s = { ...withServer(newGame(1)), cash: 10_000_000 };
    const server = s.devices.find((d) => d.components.some((c) => c.kind === "ram"))!;
    const old = server.components.find((c) => c.kind === "ram")!;
    Object.assign(server, { rackId: null, store: "loc1" });
    server.components = server.components.filter((c) => c !== old);
    const part = partOffers(yearOf(s.hour)).find((o) => samePart(o, specOf(old)))!;
    expect(part).toBeTruthy();
    const r = buyDevice(s, "part-ram", "Generic", 1, "loc1", { part });
    expect(r.ok).toBe(true);
    const spare = s.devices.find((d) => d.model === "part-ram")!;
    Object.assign(spare, { store: "loc1", transitTo: null, arriveAt: null });
    const ir = installPart(s, server.id, spare.id); expect(ir.ok ? "ok" : ir.error).toBe("ok");
    const now = server.components.find((c) => c.kind === "ram")!;
    expect(partLabel(now)).toBe(partLabel(old));
  });
});
