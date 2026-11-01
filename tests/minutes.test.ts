import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { orderLead } from "../src/sim/30-market/orders";
import { register, REGISTER_MINUTES, registering } from "../src/sim/30-customers/registry";
import { bootUp } from "../src/sim/60-infra/power";
import { BOOT_MINUTES, booting, working } from "../src/sim/60-infra/status";
import { tick, tickMinute } from "../src/sim/88-tick/tick";
import { runAction } from "../src/sim/90-actions/index";
import { quoteOrder } from "../src/sim/90-actions/orders";
import { replay, runFile } from "../src/sim/92-run/run";
import { readyGame, withServer, newGame, startGame } from "./fixtures";

const minutes = (s: Parameters<typeof tickMinute>[0], n: number) => { for (let i = 0; i < n; i++) tickMinute(s); };

describe("game minutes", () => {
  it("starts at minute 0, which the hourly tick resets", () => {
    const s = newGame(1);
    expect(s.minute).toBe(0);
    minutes(s, 59);
    expect([s.hour, s.minute]).toEqual([0, 59]);
    tickMinute(s);
    expect([s.hour, s.minute]).toEqual([1, 0]);
    s.minute = 17;
    tick(s);
    expect([s.hour, s.minute]).toEqual([2, 0]);
  });

  it("lands queued order work at its minute instead of the next hour", () => {
    const s = readyGame(5);
    const r = orderLead(s, "private", "Frankfurt", [], { product: "webHosting", size: 0, sla: "basic" }, true);
    const req = () => s.sales.requests.find((x) => x.id === r.id)!;
    expect(quoteOrder(s, r.ticketId!, 10).ok).toBe(true);
    const hour = s.hour;
    minutes(s, 4);
    expect(req().replyAt).toBeNull();
    tickMinute(s);
    expect(req().replyAt).not.toBeNull();
    expect([s.hour, s.minute]).toEqual([hour, 5]);
    expect(req().thread.at(-1)!.key).toMatch(/^reply\.order\.quote/);
  });

  it("boots a server in minutes", () => {
    const s = withServer(startGame(1));
    const d = s.devices.find((x) => x.id === "dev3")!;
    bootUp(s, d);
    expect(booting(s, d)).toBe(true);
    minutes(s, BOOT_MINUTES - 1);
    expect(booting(s, d)).toBe(true);
    tickMinute(s);
    expect(booting(s, d)).toBe(false);
    expect(working(s, "dev3")).toBe(true);
  });

  it("registers a domain in minutes, and old saves count theirs as registered", () => {
    const s = newGame(2);
    register(s, "example.de", null, false);
    const d = () => s.domains.find((x) => x.name === "example.de")!;
    expect(registering(s, d())).toBe(true);
    minutes(s, REGISTER_MINUTES);
    expect(registering(s, d())).toBe(false);
    expect(registering(s, { ...d(), readyAt: undefined })).toBe(false);
  });

  it("logs the minute of an action and replays it there", () => {
    const s = startGame(3);
    minutes(s, 30);
    const r = runAction(s, "setCompany", [{ name: "Minute Hosting", color: "oklch(0.65 0.17 50)" }]);
    expect(r.ok).toBe(true);
    expect(s.log.at(-1)).toMatchObject({ hour: 0, minute: 30, name: "setCompany" });
    const seen: number[] = [];
    const back = replay(runFile(s, "test"), (x) => seen.push(nowMinutes(x)), 2);
    expect(back.company.name).toBe("Minute Hosting");
    expect(seen).toEqual([60, 120]);
  });
});
