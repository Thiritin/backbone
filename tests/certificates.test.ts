import { describe, expect, it } from "vitest";
import { CA_NAME, caPrice } from "../src/sim/10-catalog/products";
import { CERT_TOPIC, CERT_WANT, certificateOf, offerCertificate, wantCertificate } from "../src/sim/30-customers/certificates";
import type { GameState } from "../src/sim/50-state";
import type { Profile } from "../src/sim/30-customers/customers";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { offerUpgrade } from "../src/sim/90-actions/orders";
import { setLine } from "../src/sim/90-actions/website";
import { readyGame, skipTo } from "./fixtures";

// A customer with a domain service standing in for their web hosting: the offer only reads the customer and the domain.
function customer(s: GameState, profile: Profile = "smallBiz", domain = "kunde.de") {
  const id = addCustomer(s, "Kunde", profile);
  provisionService(s, id, "domain", { label: domain });
  return s.services.find((v) => v.customerId === id)!;
}
const listSsl = (s: GameState) => { s.marketing = { ...s.marketing, lines: [...s.marketing.lines, "ssl"] }; };
// A running shop whose variant sells SSL, with the line on the website.
const sellSsl = (s: GameState) => { listSsl(s); s.shop = { ...s.shop, variant: "whmCache" }; };
// What the certificate authority charged: on its invoices, or straight from the cash before suppliers invoice.
const caCost = (s: GameState) =>
  s.payables.filter((p) => p.name === CA_NAME).reduce((n, p) => n + p.amount, 0) -
  s.ledger.filter((e) => e.key === "ledger.certificates" && e.params.name === CA_NAME).reduce((n, e) => n + e.amount, 0);
const certTickets = (s: GameState) => s.tickets.filter((t) => t.kind === "upgrade" && t.topic === CERT_TOPIC);

describe("SSL certificates", () => {
  it("are booked by customers only while the shop sells them", () => {
    const s = readyGame(1), v = customer(s);
    listSsl(s);
    expect(offerCertificate(s, v, 1)).toBeNull();
    expect(wantCertificate(s, v, 1)).toBeNull();
    expect(s.services.some((x) => x.product === "ssl")).toBe(false);
    expect(certTickets(s)).toHaveLength(1);
    sellSsl(s);
    const id = offerCertificate(s, v, 1);
    expect(s.services.find((x) => x.id === id)).toMatchObject({ product: "ssl", label: "kunde.de", period: "year", price: 50, customerId: v.customerId });
    expect(certificateOf(s, "kunde.de")?.id).toBe(id);
    expect(offerCertificate(s, v, 1)).toBeNull();
  });

  it("need a registrar partner and stop selling to private customers once certificates are free", () => {
    const s = readyGame(1), v = customer(s);
    sellSsl(s);
    s.registrar = null;
    expect(offerCertificate(s, v, 1)).toBeNull();
    expect(setLine(s, "ssl", true)).toMatchObject({ ok: false, error: "error.needsRegistrar" });
    const later = readyGame(1), w = customer(later, "private");
    sellSsl(later);
    skipTo(later, 2016);
    expect(offerCertificate(later, w, 1)).toBeNull();
  });

  it("are bought from the certificate authority each time the customer is billed for one", () => {
    const s = readyGame(1);
    sellSsl(s);
    offerCertificate(s, customer(s, "enterprise"), 1);
    tick(s);
    expect(caCost(s)).toBe(caPrice("ev", 2005));
  });

  it("are quoted as an SSL upgrade before the shop, and the accepted quote adds the certificate and its cost", () => {
    const s = readyGame(2), v = customer(s, "office", "praxis.de");
    wantCertificate(s, v, 1);
    tick(s);
    const r = s.sales.requests.find((x) => x.kind === "expansion" && x.product === "ssl")!;
    expect(r).toMatchObject({ serviceId: v.id, spec: { cert: "ov" } });
    expect(r.thread[0]).toMatchObject({ key: "sales.msg.cert", params: { domain: "praxis.de" } });
    const price = Math.round(r.reference * 50) / 100;
    expect(offerUpgrade(s, r.id, price).ok).toBe(true);
    expect(s.sales.requests.find((x) => x.id === r.id)!.thread.at(-1)!.key).toBe("sales.you.cert");
    for (let i = 0; i < 48 && s.sales.requests.find((x) => x.id === r.id)!.status === "quoted"; i++) tick(s);
    expect(s.sales.requests.find((x) => x.id === r.id)!.status).toBe("won");
    expect(certificateOf(s, "praxis.de")).toMatchObject({ customerId: v.customerId, price, spec: { cert: "ov" }, endedAt: null });
    expect(s.services.find((x) => x.id === v.id)!.endedAt).toBeNull();
    tick(s);
    expect(caCost(s)).toBe(caPrice("ov", 2005));
  });

  it("are asked for by large companies far more often than by small ones", () => {
    const s = readyGame(3), n = 300;
    const asks = (p: Profile) => {
      const before = certTickets(s).length;
      for (let i = 0; i < n; i++) wantCertificate(s, customer(s, p, `${p}${i}.de`), CERT_WANT[p]);
      return certTickets(s).length - before;
    };
    const [priv, small, office, big] = [asks("private"), asks("smallBiz"), asks("office"), asks("enterprise")];
    expect(priv).toBeLessThan(n * 0.05);
    expect(small).toBeLessThan(n * 0.1);
    expect(office).toBeGreaterThan(small * 3);
    expect(big).toBeGreaterThan(n * 0.6);
    expect(big).toBeGreaterThan((priv + small) * 5);
  });
});
