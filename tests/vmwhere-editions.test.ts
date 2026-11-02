import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "../src/sim/50-state";
import { clusterDefaults } from "../src/sim/60-infra/cluster";
import { editionAllows, editionOf } from "../src/sim/60-infra/vmwhere";
import { cartOf, lineOffer, offers } from "../src/sim/80-business/vendor-shop";
import { tick } from "../src/sim/88-tick/tick";
import { setHa } from "../src/sim/90-actions/clusters";
import { activateLicence, removeLicence } from "../src/sim/90-actions/licence";
import { addToCart, changeEdition, checkout } from "../src/sim/90-actions/vendor-shop";
import * as consoleActions from "../src/sim/90-actions/vmwhere";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyKey, hypervisor, orderDetails, withCard, withServer } from "./fixtures";

const SITE = "vmwhere.com";
const setup = (skills = ["monitoring", "virtualization"]) => {
  const s: GameState = withCard({ ...withServer(newGame(1)), cash: 100_000 });
  s.unlocks = [...s.unlocks, ...skills];
  const c = hypervisor(s, ["dev3"], "VW", "vmwhere");
  // The install finishing puts a new cluster whose host runs its trial on Essentials.
  removeLicence(s, "dev3", "vmwhere");
  s.clusters = s.clusters.map((x) => (x.id === c ? { ...x, platform: null, licence: undefined, switching: { kind: "cloud" as const, to: "vmwhere", doneAt: s.hour } } : x));
  tick(s);
  return { s, c };
};
const cl = (s: GameState, id: string) => s.clusters.find((x) => x.id === id)!;
// Types the key into the cluster's one host in place of the key it holds.
const typeIn = (s: GameState, key: string) => {
  removeLicence(s, "dev3", "vmwhere");
  return activateLicence(s, "dev3", "vmwhere", key);
};

describe("VMwhere editions", () => {
  it("starts a new cluster on Essentials and refuses failover", () => {
    const { s, c } = setup();
    expect(editionOf(cl(s, c))).toBe("essentials");
    expect(editionAllows(cl(s, c), "failover")).toBe(false);
    expect(setHa(s, c, "failover", true)).toEqual({ ok: false, error: "error.needsEdition" });
  });

  it("sells editions only on vmwhere.com, and the key typed into the host sets the cluster's edition", () => {
    const { s, c } = setup();
    expect(Object.keys(consoleActions)).not.toContain("upgradeEdition");
    expect(offers("vmwhere", s.hour).map((o) => [o.edition, o.fee])).toEqual([["essentials", 600], ["standard", 1200], ["enterprise", 2400]]);
    const cash = s.cash, k = buyKey(s, "vmwhere", "standard");
    expect(s.cash).toBe(cash);
    expect(editionOf(cl(s, c))).toBe("essentials");
    expect(typeIn(s, k.key)).toMatchObject({ ok: true });
    expect(editionOf(cl(s, c))).toBe("standard");
    expect(setHa(s, c, "failover", true)).toMatchObject({ ok: true });
    expect(editionAllows(cl(s, c), "drs")).toBe(false);

    expect(changeEdition(s, k.id, "enterprise")).toMatchObject({ ok: true });
    expect(lineOffer(s, cartOf(s, SITE)[0])?.fee).toBe(1200);
    expect(checkout(s, SITE, orderDetails(s, "card"))).toMatchObject({ ok: true });
    expect(editionOf(cl(s, c))).toBe("enterprise");
    expect(editionAllows(cl(s, c), "pools")).toBe(true);

    removeLicence(s, "dev3", "vmwhere");
    expect(editionOf(cl(s, c))).toBe("essentials");
  });

  it("refuses an edition with a feature the team has not learned, in the cart, the edition change and the checkout", () => {
    const { s } = setup([]);
    expect(addToCart(s, "vmwhere", "standard")).toEqual({ ok: false, error: "error.unknownFeature" });
    expect(addToCart(s, "vmwhere", "enterprise")).toEqual({ ok: false, error: "error.unknownFeature" });
    const k = buyKey(s, "vmwhere", "essentials");
    expect(changeEdition(s, k.id, "standard")).toEqual({ ok: false, error: "error.unknownFeature" });
    s.cart = [{ product: "vmwhere", edition: "standard", qty: 1 }];
    expect(checkout(s, SITE, orderDetails(s, "card"))).toEqual({ ok: false, error: "error.unknownFeature" });

    s.unlocks = [...s.unlocks, "monitoring"];
    expect(addToCart(s, "vmwhere", "standard")).toEqual({ ok: false, error: "error.unknownFeature" });
    s.unlocks = [...s.unlocks, "virtualization"];
    expect(addToCart(s, "vmwhere", "enterprise")).toMatchObject({ ok: true });
    expect(checkout(s, SITE, orderDetails(s, "card"))).toMatchObject({ ok: true });
  });

  it("an old VMwhere cluster without a tier loads as Enterprise", () => {
    const { s, c } = setup();
    const old = { ...cl(s, c) } as Partial<ReturnType<typeof cl>>;
    delete old.licence;
    s.clusters = s.clusters.map((x) => (x.id === c ? (old as ReturnType<typeof cl>) : x));
    const back = deserialize(serialize(s))!;
    expect(editionOf(cl(back, c))).toBe("enterprise");
    expect(clusterDefaults({ nodes: [], platform: "vmwhere" }).licence?.tier).toBe("enterprise");
  });
});
