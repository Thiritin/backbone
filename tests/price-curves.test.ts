import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { businessPowerPrice } from "../src/sim/10-catalog/economy";
import { marketPrice, sizeSpec } from "../src/sim/10-catalog/products";
import { licenceIndex } from "../src/sim/10-catalog/licence-tiers";
import { certificatesTick, offerCertificate, paidShare } from "../src/sim/30-customers/certificates";
import type { Profile } from "../src/sim/30-customers/customers";
import { registrarBill } from "../src/sim/30-customers/registrar";
import { domainFee, registryCost } from "../src/sim/30-customers/registry";
import type { GameState } from "../src/sim/50-state";
import { offers } from "../src/sim/80-business/vendor-shop";
import { NEWS, newsTick } from "../src/sim/80-business/news";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { readyGame } from "./fixtures";

const jan = (year: number, month = 1) => hourOf(new Date(Date.UTC(year, month - 1, 1)));
const web = (y: number) => marketPrice("webHosting", sizeSpec("webHosting", 1, y), y);
const ssl = (size: number, y: number) => marketPrice("ssl", sizeSpec("ssl", size, y), y);

function hosting(s: GameState, profile: Profile, domain: string) {
  const id = addCustomer(s, "Kunde", profile);
  provisionService(s, id, "domain", { label: domain });
  return s.services.find((v) => v.customerId === id)!;
}

describe("prices over time", () => {
  it("follow the keyframes of the fixed-price lines", () => {
    expect(businessPowerPrice(2022)).toBe(0.35);
    expect(web(2005)).toBe(6);
    expect(web(2022)).toBeLessThan(web(2005) * 0.85);
    expect(web(2023) / web(2022)).toBeCloseTo(1.1, 1);
    expect(domainFee(2005)).toBe(15);
    expect(domainFee(2016)).toBeCloseTo(13.95, 2);
    expect(domainFee(2026)).toBe(15);
    expect(marketPrice("dedicated", sizeSpec("dedicated", 0, 2021), 2021)).toBeLessThan(marketPrice("dedicated", sizeSpec("dedicated", 0, 2005), 2005) * 0.7);
  });

  it("sell DV, OV and EV certificates at their own prices", () => {
    expect([ssl(0, 2005), ssl(1, 2005), ssl(2, 2005)]).toEqual([50, 150, 400]);
    expect([ssl(0, 2026), ssl(1, 2026), ssl(2, 2026)]).toEqual([15, 100, 200]);
  });

  it("keep business customers paying for certificates once they are free", () => {
    expect(paidShare("private", 2016)).toBe(0);
    expect(paidShare("smallBiz", 2016)).toBeCloseTo(0.875);
    expect(paidShare("smallBiz", 2023)).toBe(0);
    expect(paidShare("office", 2030)).toBe(1);
    const s = readyGame(3);
    s.marketing = { ...s.marketing, lines: [...s.marketing.lines, "ssl"] };
    s.hour = jan(2018);
    expect(offerCertificate(s, hosting(s, "private", "a.de"), 1)).toBeNull();
    const ovId = offerCertificate(s, hosting(s, "office", "b.de"), 1), evId = offerCertificate(s, hosting(s, "enterprise", "c.de"), 1);
    const ov = s.services.find((v) => v.id === ovId)!, ev = s.services.find((v) => v.id === evId)!;
    expect([ov.spec.cert, ev.spec.cert]).toEqual(["ov", "ev"]);
    // NameCheep's €12 DV price, four times for OV and ten times for EV, a twelfth a month.
    expect(registrarBill(s).find((e) => e.key === "ledger.certificates")?.amount).toBe(-14);
  });

  it("end private customers' paid DV certificates on 1 January 2016", () => {
    const s = readyGame(4);
    s.marketing = { ...s.marketing, lines: [...s.marketing.lines, "ssl"] };
    const priv = offerCertificate(s, hosting(s, "private", "a.de"), 1)!, office = offerCertificate(s, hosting(s, "office", "b.de"), 1)!;
    s.hour = jan(2016);
    expect(certificatesTick(s)).toEqual([{ app: "Books", key: "event.certificatesFree", params: { n: 1 } }]);
    expect(s.services.find((v) => v.id === priv)!.endedAt).toBe(s.hour);
    expect(s.services.find((v) => v.id === office)!.endedAt).toBeNull();
  });

  it("raise licence and registry prices on the announced date", () => {
    expect(licenceIndex("cpanic", 2020)).toBe(1);
    expect(licenceIndex("cpanic", 2021)).toBe(1.1);
    const solo = (h: number) => offers("cpanic", h).find((o) => o.edition === "solo")!.fee;
    expect(solo(jan(2021))).toBeCloseTo(solo(jan(2020)) * 1.1, 2);
    expect(registryCost("x.com", 2021, 7)).toBe(7.85);
    expect(registryCost("x.com", 2021, 8)).toBe(8.39);
    expect(registryCost("x.de", 2021, 8)).toBeCloseTo(12 - 6 * (16 / 21), 2);
  });

  it("announce price changes in the News months before", () => {
    const at = (id: string) => NEWS.find((d) => d.id === id);
    expect(at("licenceRise.cpanic.2021")).toMatchObject({ key: "event.news.licenceRise", at: jan(2020, 10) + 9, params: { name: "cPanic", pct: 10, at: jan(2021) } });
    expect(at("licence.cpanic.2019.6")).toMatchObject({ key: "event.news.licenceModel", at: jan(2019, 3) + 9 });
    expect(at("licence.vmwhere.2023.12")).toMatchObject({ at: jan(2023, 9) + 9 });
    expect(at("registry.VeriSigh.2021")).toMatchObject({ key: "event.news.registryPrice", at: jan(2021, 3) + 9, params: { price: 8.39, at: jan(2021, 9) } });
    expect(at("marketPrice.webHosting.2023")).toMatchObject({ key: "event.news.marketPrice", at: jan(2022, 10) + 9, params: { pct: 10 } });
    const s = readyGame(5);
    s.hour = jan(2020, 10) + 9;
    expect(newsTick(s).map((e) => e.key)).toContain("event.news.licenceRise");
  });
});
