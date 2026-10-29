import { describe, expect, it } from "vitest";
import { monthNet, pickSound, soundFor, WINDOW_MS } from "../src/ui/sounds";
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
});
