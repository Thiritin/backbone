import { describe, expect, it } from "vitest";
import { hourOf, isMonthStart } from "../src/sim/00-core/time";
import { FLYER_NAME, FLYER_SIZES } from "../src/sim/10-catalog/flyers";
import { wholesale } from "../src/sim/30-customers/registrar";
import { cents } from "../src/sim/45-billing/billing";
import type { GameState } from "../src/sim/50-state";
import { AGENCY_TITLE } from "../src/sim/80-business/browser";
import { marketingTick, PLATFORMS } from "../src/sim/80-business/marketing";
import { shopBills } from "../src/sim/80-business/shop";
import { vendorName } from "../src/sim/80-business/vendor-shop";
import { orderFlyers, setReviewPlatform, setUpChannel } from "../src/sim/90-actions/marketing";
import { orderDomain } from "../src/sim/90-actions/registrar";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { hire, readyGame, withCard } from "./fixtures";

const partner = "registrar" as const;
const nextMonth = (s: GameState) => { do s.hour++; while (!isMonthStart(s.hour)); marketingTick(s); };

describe("domain order", () => {
  it("bills the first month at the order with the chosen method", () => {
    const s = withCard(readyGame(3)), n = s.payables.length;
    expect(orderDomain(s, "second-shop.de", "card").ok).toBe(true);
    expect(s.payables).toHaveLength(n + 1);
    expect(s.payables.at(-1)).toMatchObject({ supplier: partner, method: "card", amount: cents(wholesale(s, "second-shop.de") / 12) });
    expect(s.payables.at(-1)!.lines[0]).toMatchObject({ key: "ledger.domains", category: "domains", params: { count: 1 } });
  });

  it("leaves the domain unregistered when the payment fails", () => {
    const s = readyGame(3);
    expect(orderDomain(s, "second-shop.de", "card").ok).toBe(false);
    expect(s.domains.some((d) => d.name === "second-shop.de")).toBe(false);
  });

  it("starts on the monthly bill without a method", () => {
    const s = readyGame(3), n = s.payables.length;
    expect(orderDomain(s, "second-shop.de").ok).toBe(true);
    expect(s.payables).toHaveLength(n);
  });
});

describe("marketing vendors", () => {
  it("bills flyers from the print shop and channel setup from the agency", () => {
    const s = withCard(readyGame(3));
    expect(orderFlyers(s, s.locations[0].city, FLYER_SIZES[0], "card").ok).toBe(true);
    expect(s.payables.at(-1)).toMatchObject({ supplier: "services", name: FLYER_NAME });
    expect(setUpChannel(s, "website", "card").ok).toBe(true);
    expect(s.payables.at(-1)).toMatchObject({ supplier: "services", name: AGENCY_TITLE });
  });

  it("splits the monthly bill into the agency, the review platform and the shop software", () => {
    const s = readyGame(3);
    setUpChannel(s, "website", "transfer");
    hire(s, visibleCandidates(s).find((c) => c.role === "marketing")!.id);
    expect(setReviewPlatform(s, "trustPylon").ok).toBe(true);
    s.hour = hourOf(new Date(Date.UTC(2007, 2, 10, 9)));
    s.shop = { ...s.shop, variant: "orderBocks" };
    s.services = s.services.map((x) => ({ ...x, viaShop: true }));
    const n = s.payables.length;
    nextMonth(s);
    const fresh = s.payables.slice(n);
    expect(fresh.find((p) => p.name === PLATFORMS.trustPylon.name)!.lines.map((l) => l.key)).toEqual(["ledger.reviewPlatform"]);
    expect(fresh.find((p) => p.name === AGENCY_TITLE)!.lines.every((l) => l.key !== "ledger.reviewPlatform" && l.key !== "ledger.shopCut")).toBe(true);
    expect(shopBills(s).length).toBeGreaterThan(0);
    expect(fresh.find((p) => p.supplier === "shopVendor")).toMatchObject({ name: vendorName("orderBocks") });
  });
});
