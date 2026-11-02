import { describe, expect, it } from "vitest";
import { serviceOnline } from "../src/sim/40-support/status";
import { phpAbuse } from "../src/sim/60-infra/php";
import { readOnlySweep } from "../src/sim/60-infra/status";
import { howToFactor } from "../src/sim/85-products/products";
import { tick } from "../src/sim/88-tick/tick";
import { bigGame } from "./support.helpers";

describe("support at scale", () => {
  it("raises the same tickets for 150 customers", () => {
    const s = bigGame(1, 150);
    for (let i = 0; i < 12; i++) tick(s);
    const kinds: Record<string, number> = {};
    for (const t of s.tickets) kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;
    const happiness = s.customers.reduce((n, c) => n + c.happiness, 0) / s.customers.length;
    expect({ kinds, happiness: happiness.toFixed(4), down: Object.keys(s.downSince).length, last: s.tickets.at(-1)?.id }).toMatchInlineSnapshot(`
      {
        "down": 8,
        "happiness": "69.8366",
        "kinds": {
          "howTo": 1,
          "outage": 3,
        },
        "last": "tkt502",
      }
    `);

    const read = () => ({
      factors: s.customers.map((c) => [howToFactor(s, c.id), phpAbuse(s, c.id)]),
      online: s.services.map((v) => serviceOnline(s, v.id)),
    });
    expect(readOnlySweep(s, read)).toEqual(read());
  }, 60_000);
});
