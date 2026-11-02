import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { crossConnectTargets } from "../src/sim/10-catalog/network";
import { crossConnectSetup, DATACENTERS, spacePrice } from "../src/sim/20-world/datacenters";
import { type GameState } from "../src/sim/50-state";
import { crossConnects, type Uplink } from "../src/sim/60-infra/network";
import { priceRaise, tick } from "../src/sim/88-tick/tick";
import { addLocation, cancelContract, cancelCrossConnect, closeLocation, orderCrossConnect } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { freeFloor, newGame } from "./fixtures";

const ok = (r: ReturnType<typeof addLocation>) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const err = (r: ReturnType<typeof addLocation>) => (r.ok ? "ok" : r.error);
const rich = (): GameState => freeFloor({ ...newGame(1), cash: 1_000_000 });
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const FR5 = DATACENTERS.find((d) => d.id === "equinox-fr5")!;
const MARCOUSSIS = DATACENTERS.find((d) => d.id === "data5-marcoussis")!;

describe("cross-connects", () => {
  it("reach the carriers on sale and only an exchange on site", () => {
    expect(crossConnectTargets(FR5).map((x) => x.id)).toContain("dekicks");
    expect(crossConnectTargets(MARCOUSSIS).map((x) => x.id)).toEqual(["cogentle", "drizzle"]);
  });

  it("are ordered for a setup fee, billed monthly with the rent and stop when cancelled", () => {
    const s = rich();
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 15)));
    const loc = ok(addLocation(s, FR5.id, "share", 2));
    const c = s.contracts[0];
    expect(err(orderCrossConnect(s, c.id, "nowhere"))).toBe("error.noCrossConnectTarget");
    expect(err(orderCrossConnect(s, "nope", "cogentle"))).toBe("error.unknownContract");
    const cash = s.cash;
    const id = ok(orderCrossConnect(s, c.id, "cogentle"));
    expect(s.cash).toBe(cash - crossConnectSetup(FR5));
    expect(s.crossConnects).toEqual([{ id, contractId: c.id, to: "cogentle", monthly: FR5.crossConnect, since: s.hour }]);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.crossConnectSetup", category: "rent", params: { to: "Cogentle", dc: FR5.id } });
    runTo(s, hourOf(new Date(Date.UTC(2005, 3, 1))) + 1);
    expect(s.ledger.filter((e) => e.key === "ledger.crossConnect")).toMatchObject([{ amount: -FR5.crossConnect, params: { to: "Cogentle", dc: FR5.id } }]);
    expect(err(cancelCrossConnect(s, "nope"))).toBe("error.unknownCrossConnect");
    ok(cancelCrossConnect(s, id));
    runTo(s, hourOf(new Date(Date.UTC(2005, 4, 1))) + 1);
    expect(s.ledger.filter((e) => e.key === "ledger.crossConnect")).toHaveLength(1);
    ok(orderCrossConnect(s, c.id, "dekicks"));
    ok(cancelContract(s, c.id));
    expect(err(orderCrossConnect(s, c.id, "drizzle"))).toBe("error.alreadyCancelled");
    ok(closeLocation(s, loc));
    expect(s.crossConnects).toEqual([]);
  });

  it("carry an uplink's link so the network does not bill it twice", () => {
    const s = rich();
    const loc = ok(addLocation(s, FR5.id, "share", 2));
    const link = { id: "l", gbit: 1, device: "d", port: 0, readyAt: 0 };
    const u = { id: "u", locationId: loc, kind: "transit", partner: "cogentle", commit: 0, links: [link, { ...link, id: "l2" }], samples: [] } as Uplink;
    expect(crossConnects(s, u)).toBe(2 * FR5.crossConnect);
    ok(orderCrossConnect(s, s.contracts[0].id, "cogentle"));
    ok(orderCrossConnect(s, s.contracts[0].id, "drizzle"));
    expect(crossConnects(s, u)).toBe(FR5.crossConnect);
  });

  it("default for old saves", () => {
    const { crossConnects: _, providerPrices: __, ...old } = JSON.parse(serialize(rich()));
    const back = deserialize(JSON.stringify(old));
    expect(back.crossConnects).toEqual([]);
    expect(back.providerPrices).toEqual({});
  });
});

describe("price changes", () => {
  it("raise a provider's price for new contracts and mail its customers", () => {
    const s = rich();
    ok(addLocation(s, FR5.id, "share", 2));
    const before = s.contracts[0].monthly;
    s.hour = hourOf(new Date(Date.UTC(2006, 0, 1)));
    priceRaise(s);
    const factor = s.providerPrices.equinox;
    expect(factor).toBeGreaterThanOrEqual(1.02);
    expect(factor).toBeLessThanOrEqual(1.05);
    expect(s.contracts[0].monthly).toBe(before);
    expect(s.tickets.at(-1)).toMatchObject({ kind: "mail", topic: "priceRaise", mail: { from: "Equinox", params: { percent: Math.round((factor - 1) * 100), year: 2006 } } });
    ok(addLocation(s, FR5.id, "share", 2));
    expect(s.contracts[1].monthly).toBe(spacePrice(FR5, "share", 2, s.providerPrices));
    expect(s.contracts[1].monthly).toBeGreaterThan(before);
  });

  it("raise someone silently when the player rents nothing", () => {
    const s = rich();
    s.hour = hourOf(new Date(Date.UTC(2006, 0, 1)));
    const mails = s.tickets.length;
    priceRaise(s);
    expect(Object.keys(s.providerPrices)).toHaveLength(1);
    expect(s.tickets).toHaveLength(mails);
  });

  it("happen at the January month start", () => {
    const s = rich();
    s.hour = hourOf(new Date(Date.UTC(2005, 11, 31)));
    runTo(s, hourOf(new Date(Date.UTC(2006, 0, 1))) + 1);
    expect(Object.keys(s.providerPrices)).toHaveLength(1);
  });
});
