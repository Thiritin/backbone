import { describe, expect, it } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import { certificateOf, offerCertificate } from "../src/sim/30-customers/certificates";
import { registrarBill } from "../src/sim/30-customers/registrar";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setLine } from "../src/sim/90-actions/website";
import { readyGame, skipTo } from "./fixtures";

// A customer with a domain service standing in for their web hosting: the offer only reads the customer and the domain.
function customer(s: GameState) {
  const id = addCustomer(s, "Kunde", "smallBiz");
  provisionService(s, id, "domain", { label: "kunde.de" });
  return s.services.find((v) => v.customerId === id)!;
}
const listSsl = (s: GameState) => { s.marketing = { ...s.marketing, lines: [...s.marketing.lines, "ssl"] }; };

describe("SSL certificates", () => {
  it("sell only while the website lists them", () => {
    const s = readyGame(1), v = customer(s);
    expect(offerCertificate(s, v, 1)).toBeNull();
    listSsl(s);
    const id = offerCertificate(s, v, 1);
    const cert = s.services.find((x) => x.id === id)!;
    expect(cert).toMatchObject({ product: "ssl", label: "kunde.de", period: "year", price: 50, customerId: v.customerId });
    expect(certificateOf(s, "kunde.de")?.id).toBe(id);
    expect(offerCertificate(s, v, 1)).toBeNull();
  });

  it("need a registrar partner and stop selling once certificates are free", () => {
    const s = readyGame(1), v = customer(s);
    listSsl(s);
    s.registrar = null;
    expect(offerCertificate(s, v, 1)).toBeNull();
    expect(setLine(s, "ssl", true)).toMatchObject({ ok: false, error: "error.needsRegistrar" });
    const later = readyGame(1), w = customer(later);
    listSsl(later);
    skipTo(later, 2016);
    expect(offerCertificate(later, w, 1)).toBeNull();
  });

  it("are a share the player's rate lowers", () => {
    const s = readyGame(1);
    listSsl(s);
    expect(offerCertificate(s, customer(s), 0)).toBeNull();
    s.rates = { ...s.rates, ssl: { base: 1e6 } };
    expect(offerCertificate(s, customer(s), 1)).toBeNull();
  });

  it("are billed by the registrar partner every month", () => {
    const s = readyGame(1), v = customer(s);
    listSsl(s);
    offerCertificate(s, v, 1);
    expect(registrarBill(s).find((e) => e.key === "ledger.certificates")).toMatchObject({ params: { name: "NameCheep", count: 1 }, amount: -1 });
    do tick(s); while (!isMonthStart(s.hour));
    expect(s.ledger.some((e) => e.key === "ledger.certificates" && e.hour === s.hour)).toBe(true);
  });
});
