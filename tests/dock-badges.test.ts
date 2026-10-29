import { describe, expect, it } from "vitest";
import type { Ticket } from "../src/sim/40-support/tickets";
import type { Invoice } from "../src/sim/45-billing/billing";
import { newGame } from "../src/sim/50-state";
import { appByName, dockBadge } from "../src/ui/apps/registry";

describe("dock badges", () => {
  it("shows Support for free and the rest after the upgrade", () => {
    const s = newGame(1);
    s.tickets = [{ status: "open" } as Ticket];
    s.invoices = [{ status: "open" } as Invoice];
    const support = appByName("Support");
    const billing = appByName("Billing");
    expect(dockBadge(s, support)).toBe(1);
    expect(dockBadge(s, billing)).toBe(0);
    s.installed.push("dockBadges");
    expect(dockBadge(s, billing)).toBe(1);
    expect(dockBadge(s, support)).toBe(1);
  });
});
