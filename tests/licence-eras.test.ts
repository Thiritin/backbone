import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { assignKey, issueKey } from "../src/sim/60-infra/licence";
import { installedCores } from "../src/sim/60-infra/status";
import { offers, upgradeOffer } from "../src/sim/80-business/vendor-shop";
import { keyFee, licenseCost, renewKeys } from "../src/sim/85-products/products";
import { addToCart, checkout } from "../src/sim/90-actions/vendor-shop";
import { BASEMENT_SERVER, newGame, startGame, withServer } from "./fixtures";

const at = (y: number, m: number, d = 1) => hourOf(new Date(Date.UTC(y, m - 1, d)));
const game = (hour: number) => Object.assign(newGame(41), { hour, cash: 50_000 });

describe("licence eras", () => {
  it("stops selling a perpetual licence on the day the vendor ends it", () => {
    expect(offers("vmwhere", at(2023, 11))).toEqual([{ edition: null, fee: 600, kind: "once", period: undefined }]);
    expect(offers("vmwhere", at(2023, 12))).toEqual([{ edition: null, fee: 96, kind: "core", period: "year" }]);
    expect(offers("windoors", at(2016, 9))[0].kind).toBe("once");
    expect(offers("windoors", at(2016, 10))[0].kind).toBe("core");
    expect(offers("directadmen", at(2019, 8)).map((o) => o.edition)).toEqual(["standard", null]);
    expect(offers("directadmen", at(2019, 9)).map((o) => o.edition)).toEqual(["personal", "lite", "standard"]);
    expect(offers("cpanic", at(2019, 5)).map((o) => o.edition)).toEqual(["dedicated"]);
    expect(offers("cpanic", at(2019, 6)).map((o) => o.edition)).toEqual(["solo", "admin", "pro", "premier"]);

    const s = game(at(2019, 8, 20));
    expect(addToCart(s, "directadmen", null)).toEqual({ ok: true });
    s.hour = at(2019, 9);
    expect(checkout(s, "directadmen.com")).toEqual({ ok: false, error: "error.notForSale" });
  });

  it("keeps an old perpetual key covering its major without billing", () => {
    const s = game(at(2020, 3));
    const k = issueKey(s, "vmwhere", null);
    assignKey(s, k.id, "srv1");
    s.hour = at(2025, 6);
    const cash = s.cash;
    renewKeys(s);
    expect(s.licenses[0].covers).toEqual(k.covers);
    expect(s.licenses[0].covers.kind).toBe("version");
    expect(s.cash).toBe(cash);
  });

  it("renews a yearly key a year on and bills a server at least the minimum cores", () => {
    const s = game(at(2024, 3, 15));
    addToCart(s, "vmwhere", null);
    expect(checkout(s, "vmwhere.com").ok).toBe(true);
    const k = s.licenses[0];
    expect(k.covers).toEqual({ kind: "term", until: at(2025, 3, 15) });
    assignKey(s, k.id, "srv1");
    s.hour = at(2025, 3, 15);
    const cash = s.cash;
    renewKeys(s);
    expect(s.licenses[0].covers).toEqual({ kind: "term", until: at(2026, 3, 15) });
    expect(s.cash).toBe(cash - 96);

    const g = Object.assign(withServer(startGame(41)), { hour: at(2024, 3) });
    const d = g.devices.find((x) => x.id === BASEMENT_SERVER)!, sockets = d.components.filter((p) => p.kind === "cpu").length;
    assignKey(g, issueKey(g, "vmwhere", null).id, d.id);
    expect(keyFee(g, g.licenses[0])).toBe(96 * Math.max(installedCores(d), 16 * sockets));
  });

  it("shows a yearly key at a twelfth in the monthly bill", () => {
    const g = Object.assign(withServer(startGame(41)), { hour: at(2024, 3) });
    const c = { id: "c1", nodes: [{ deviceId: BASEMENT_SERVER }], vm: null, panel: null, platform: "vmwhere", appSuite: false, balancer: false };
    assignKey(g, issueKey(g, "vmwhere", null).id, BASEMENT_SERVER);
    const cost = licenseCost(g, c as unknown as Parameters<typeof licenseCost>[1]);
    expect(cost.platform).toBeCloseTo(keyFee(g, g.licenses[0]) / 12, 2);
  });

  it("offers the next major at the upgrade price within 12 months of buying the previous one", () => {
    const s = game(at(2010, 5));
    const k = issueKey(s, "windoors", null);
    const major = k.covers.kind === "version" ? k.covers.major : "";
    s.hour = at(2011, 4, 30);
    expect(upgradeOffer(s, "windoors", major)).toEqual({ fee: 300, discounted: true });
    expect(upgradeOffer(s, "windoors", "older")).toEqual({ fee: 600, discounted: false });
    s.hour = at(2011, 5);
    expect(upgradeOffer(s, "windoors", major)).toEqual({ fee: 600, discounted: false });
    s.hour = at(2017, 1);
    expect(upgradeOffer(s, "windoors", major)).toBeNull();
  });
});
