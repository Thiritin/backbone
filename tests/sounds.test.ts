import { describe, expect, it } from "vitest";
import { humOf, monthNet, pickSound, soundFor, voiceOf, WINDOW_MS } from "../src/ui/sounds";
import { OS_RELEASES } from "../src/sim/10-catalog/os";
import { newGame } from "../src/sim/50-state";
import { withServer } from "./fixtures";
import { hourOf } from "../src/sim/00-core/time";

describe("sounds", () => {
  it("maps sim events to sounds, with Support falling back to the ticket ding", () => {
    expect(soundFor("Finance", "event.monthStart")).toBe("month");
    expect(soundFor("Support", "event.orderPaid")).toBe("money");
    expect(soundFor("Locations", "event.componentFailed")).toBe("warn");
    expect(soundFor("Security", "event.vuln.hacked")).toBe("warn");
    expect(soundFor("Staff", "event.trained")).toBe("level");
    expect(soundFor("Research", "event.trainingDone")).toBe("research");
    expect(soundFor("Support", "event.ticket")).toBe("ticket");
    expect(soundFor("Locations", "event.rackArrived")).toBeNull();
  });

  it("plays one sound per batch, month end first, and each kind once per window", () => {
    expect(pickSound(["money", "ticket", "month", "warn"], 0, {})).toBe("month");
    expect(pickSound(["ticket", "money"], 0, {})).toBe("money");
    expect(pickSound(["money", "ticket"], 1000, { money: 0 })).toBe("ticket");
    expect(pickSound(["money"], WINDOW_MS - 1, { money: 0 })).toBeNull();
    expect(pickSound(["money"], WINDOW_MS, { money: 0 })).toBe("money");
    expect(pickSound([], 0, {})).toBeNull();
  });

  it("totals the month that just closed, including bills booked on its last hour", () => {
    const feb = hourOf(new Date(Date.UTC(2005, 1, 1))), jan = hourOf(new Date(Date.UTC(2005, 0, 1)));
    const e = (hour: number, amount: number) => ({ hour, category: "x", key: "x", params: {}, amount });
    expect(monthNet([e(jan, 999), e(jan + 5, 300), e(feb, -100), e(feb + 1, -999)], feb)).toBe(200);
  });

  it("hums with powered rack devices, spins up for a failed fan and stops without power", () => {
    const s = withServer(newGame(1)), base = humOf(s, ["rack2"]);
    expect(base.level).toBeGreaterThan(0);
    expect(humOf(s, ["other"]).level).toBe(0);
    s.devices.find((d) => d.id === "dev3")!.components.find((c) => c.kind === "fan")!.failedAt = s.hour;
    expect(humOf(s, ["rack2"]).pitch).toBeGreaterThan(base.pitch);
    for (const d of s.devices) for (const c of d.components) if (c.kind === "psu") c.failedAt = s.hour;
    expect(humOf(s, ["rack2"]).level).toBe(0);
  });

  it("voices every Pear OS era differently and falls back to the first", () => {
    const voices = OS_RELEASES.map((r) => JSON.stringify(voiceOf(r.id)));
    expect(new Set(voices).size).toBe(OS_RELEASES.length);
    expect(voiceOf("unknown")).toEqual(voiceOf(OS_RELEASES[0].id));
  });
});
