import { describe, expect, it } from "vitest";
import { HOURS_PER_MONTH, KNOWLEDGE_BASE, pickHowTo } from "../src/sim/40-support/tickets";
import { type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { withCompany, newGame } from "./fixtures";

const topics = (s: GameState, id: string) => {
  const c = s.customers.find((x) => x.id === id)!, seen = new Set<string>();
  for (let i = 0; i < 300; i++) seen.add(pickHowTo(s, c)?.topic ?? "none");
  return seen;
};

describe("how-to topics", () => {
  it("asks newcomers about setup and long-standing customers about what changes", () => {
    const s = withCompany(newGame(3));
    const id = addCustomer(s, "Jonas Weber", "private");
    addService(s, id, "webHosting", "site", 5, "year");
    const fresh = topics(s, id);
    expect(fresh).toContain("dns");
    expect(fresh).toContain("email");
    expect(fresh).not.toContain("php");
    expect(fresh).not.toContain("ssh");
    s.hour += 3 * 12 * HOURS_PER_MONTH;
    const veteran = topics(s, id);
    expect(veteran).not.toContain("dns");
    expect(veteran).not.toContain("upload");
    expect(veteran).toContain("php");
    expect(veteran).toContain("phone");
  });

  it("asks about the padlock only without a certificate and about SSH only with a server", () => {
    const s = withCompany(newGame(4));
    const id = addCustomer(s, "Jonas Weber", "private");
    expect(pickHowTo(s, s.customers.find((x) => x.id === id)!)).toBeNull();
    addService(s, id, "vps", "box", 0.02, "hour");
    expect(topics(s, id)).toEqual(new Set(["ssh", "panel"]));
    addService(s, id, "webHosting", "site", 5, "year");
    expect(topics(s, id)).toContain("ssl");
    addService(s, id, "ssl", "cert", 20, "year");
    expect(topics(s, id)).not.toContain("ssl");
  });
});

describe("knowledge base", () => {
  const run = (kb: boolean) => {
    const s = withCompany(newGame(7));
    if (kb) s.installed = [...s.installed, KNOWLEDGE_BASE];
    for (let i = 0; i < 150; i++) addService(s, addCustomer(s, `Customer ${i}`, "private"), "webHosting", "site", 5, "year");
    while (s.hour < 2 * HOURS_PER_MONTH) tick(s);
    return s;
  };

  it("answers about three in ten basic questions before they become tickets", () => {
    const without = run(false), withKb = run(true);
    const asked = (s: GameState) => s.tickets.filter((t) => t.kind === "howTo" && t.topic !== "panel").length;
    const reads = Object.values(withKb.kbReads).reduce((a, b) => a + b, 0);
    expect(reads).toBeGreaterThan(0);
    expect(reads / (reads + asked(withKb))).toBeGreaterThan(0.15);
    expect(reads / (reads + asked(withKb))).toBeLessThan(0.45);
    expect(asked(withKb)).toBeLessThan(asked(without));
    expect(deserialize(serialize(withKb)).kbReads).toEqual(withKb.kbReads);
  }, 60_000);

  it("loads old saves without article reads", () => {
    const data = JSON.parse(serialize(newGame(1)));
    delete data.kbReads;
    expect(deserialize(JSON.stringify(data)).kbReads).toEqual({});
  });
});
