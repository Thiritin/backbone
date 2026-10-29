import { describe, expect, it } from "vitest";
import { hourOf, isMonthStart } from "../src/sim/00-core/time";
import { MAIL_PROVIDERS, mailDelay, mailImpaired, mailShare, providerById, seatsFor } from "../src/sim/80-business/mail";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { issueInvoice } from "../src/sim/30-market/manual";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { createVm } from "../src/sim/90-actions/clusters";
import { bookMail, cancelMail, selectMailServer } from "../src/sim/90-actions/mail";
import { signRegistrar, registerCompanyDomain } from "../src/sim/90-actions/registrar";
import { installBlock, installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { hire } from "../src/sim/90-actions/staff";
import { setEmailOrders } from "../src/sim/90-actions/website";
import { CHECKS } from "../src/sim/checklist";
import { deserialize, serialize } from "../src/sim/91-save/save";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { readyGame } from "./fixtures";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const idOf = (r: ActionResult) => (r.ok ? r.id! : "");
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };
const toMonthStart = (s: GameState) => { do tick(s); while (!isMonthStart(s.hour)); };
const mailLedger = (s: GameState) => s.ledger.filter((e) => e.hour === s.hour && e.key === "ledger.companyMail");

// A mail server in a VM on the basement hypervisor, installed and running.
function selfHosted(s: GameState, software = "postfixit"): string {
  s.company = { ...s.company, mail: { kind: "none" } };
  const vm = createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 2, ramGb: 4, diskGb: 40 });
  expect(vm.ok).toBe(true);
  const r = installSoftware(s, idOf(vm), software);
  expect(err(r)).toBe("ok");
  run(s, 6);
  return idOf(r);
}

describe("external providers", () => {
  it("price a seat by the year, Hosted Exchange falling from 10 to 6", () => {
    const price = (id: string, year: number) => providerById(id)!.price(year);
    expect([2005, 2010, 2015, 2026].map((y) => price("hostedExchange", y))).toEqual([10, 8, 6, 6]);
    expect([2007, 2019, 2020].map((y) => price("goggleWorkspace", y))).toEqual([4, 4, 5]);
    expect([2011, 2021, 2022].map((y) => price("lookout365", y))).toEqual([5, 5, 6]);
    expect(MAIL_PROVIDERS.map((p) => p.from)).toEqual([2005, 2007, 2011]);
  });

  it("are booked once the company has a domain, and not before their year", () => {
    const s = newGame(1);
    expect(err(bookMail(s, "hostedExchange"))).toBe("error.needsDomain");
    signRegistrar(s, "nameCheep");
    registerCompanyDomain(s, "basement-hosting.de");
    expect(err(bookMail(s, "goggleWorkspace"))).toBe("error.mailProviderLater");
    expect(err(bookMail(s, "nope" as never))).toBe("error.unknownMailProvider");
    expect(bookMail(s, "hostedExchange").ok).toBe(true);
    expect(s.company.mail).toEqual({ kind: "external", provider: "hostedExchange", seats: 1 });
    expect(cancelMail(s).ok).toBe(true);
    expect(s.company.mail).toEqual({ kind: "none" });
    expect(err(cancelMail(s))).toBe("error.noMailService");
  });

  it("bill one seat for the owner and one for every employee at the month start", () => {
    const s = readyGame(2);
    toMonthStart(s);
    expect(mailLedger(s)).toMatchObject([{ category: "subscriptions", amount: -10, params: { seats: 1 } }]);
    for (const role of ["support", "technician"] as const) hire(s, visibleCandidates(s).find((c) => c.role === role)!.id);
    expect(seatsFor(s)).toBe(3);
    toMonthStart(s);
    expect(mailLedger(s)).toMatchObject([{ amount: -30, params: { seats: 3 } }]);
    expect(s.company.mail).toMatchObject({ seats: 3 });
  });

  it("are never impaired and never listed", () => {
    const s = readyGame(2);
    expect(mailImpaired(s)).toBe(false);
    expect(mailShare(s)).toBe(1);
    expect(mailDelay(s)).toBe(0);
  });
});

describe("the mail software", () => {
  it("installs like a panel in a VM, free of charge, once the company has a domain", () => {
    const s = readyGame(3);
    const vm = idOf(createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 1, ramGb: 2, diskGb: 40 }));
    s.company = { ...s.company, domain: null };
    expect(installBlock(s, vm, "postfixit")).toBe("error.needsDomain");
    s.company = { ...s.company, domain: "mine.de" };
    expect(installBlock(s, vm, "postfixit")).toBeNull();
    expect(installBlock(s, vm, "mailpig")).toBe("error.softwareNotYet");
    expect(installSoftware(s, vm, "postfixit").ok).toBe(true);
    const c = s.clusters.find((x) => x.kind === "mail")!;
    expect(c.switching).toMatchObject({ kind: "mail", to: "postfixit" });
    run(s, 3);
    expect(s.clusters.find((x) => x.id === c.id)!.panel).toBeNull();
    run(s, 2);
    expect(s.clusters.find((x) => x.id === c.id)!.panel).toBe("postfixit");
    expect(s.company.mail).toEqual({ kind: "self", software: "postfixit", clusterId: c.id });
  });

  it("allows one mail server per company and no panel next to it", () => {
    const s = readyGame(3);
    selfHosted(s);
    const vm2 = idOf(createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 1, ramGb: 2, diskGb: 40 }));
    expect(installBlock(s, vm2, "postfixit")).toBe("error.oneMailServer");
    const mine = s.clusters.find((c) => c.kind === "mail")!.vm!;
    expect(installBlock(s, mine, "freepanel")).toBe("error.mailHost");
  });

  it("is on sale from its year and installs Mailpig from 2015", () => {
    const s = readyGame(3);
    s.hour = hourOf(new Date(Date.UTC(2015, 0, 5)));
    const id = selfHosted(s, "mailpig");
    expect(s.clusters.find((c) => c.id === id)).toMatchObject({ kind: "mail", panel: "mailpig" });
  });

  it("goes back to no mail when the server is uninstalled", () => {
    const s = readyGame(3);
    selfHosted(s);
    const vm = s.clusters.find((c) => c.kind === "mail")!.vm!;
    expect(uninstallSoftware(s, vm).ok).toBe(true);
    expect(s.company.mail).toEqual({ kind: "none" });
    expect(s.clusters.some((c) => c.kind === "mail")).toBe(false);
  });

  it("is taken back into use after another service", () => {
    const s = readyGame(3);
    selfHosted(s);
    bookMail(s, "hostedExchange");
    expect(s.company.mail.kind).toBe("external");
    expect(selectMailServer(s).ok).toBe(true);
    expect(s.company.mail).toMatchObject({ kind: "self", software: "postfixit" });
  });
});

describe("impaired delivery", () => {
  it("lists a mail server on a dynamic line and halves email orders", () => {
    const s = readyGame(4);
    selfHosted(s);
    expect(mailImpaired(s)).toBe(false);
    expect(mailShare(s)).toBe(1);
    s.homeLine = { id: "dsl-16", next: null };
    run(s, 2);
    expect(mailImpaired(s)).toBe(true);
    expect(mailShare(s)).toBe(0.5);
  });

  it("is impaired while the mail host is down", () => {
    const s = readyGame(4);
    selfHosted(s);
    expect(mailImpaired(s)).toBe(false);
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, on: false } : d));
    expect(mailImpaired(s)).toBe(true);
  });

  it("brings fewer order emails than external mail over the same weeks", () => {
    const orders = (impaired: boolean) => {
      let n = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const s = readyGame(seed);
        s.marketing.owned = ["website"];
        if (impaired) {
          selfHosted(s);
          s.homeLine = { id: "dsl-16", next: null };
        }
        run(s, 24 * 90);
        n += s.sales.requests.filter((r) => r.kind === "order").length;
      }
      return n;
    };
    const healthy = orders(false), impaired = orders(true);
    expect(healthy).toBeGreaterThan(0);
    expect(impaired).toBeLessThan(healthy);
  }, 60_000);

  it("pays invoices sent in that window three days later", () => {
    const s = readyGame(5), c = s.customers[0];
    const pay = (x: GameState) => {
      x.rng = { ...x.rng, s: 12345 };
      return issueInvoice(x, c.id, [{ serviceId: null, key: "invoice.line.firstMonth", params: { label: "x" }, amount: 10 }]);
    };
    const copy = structuredClone(s);
    const base = pay(s);
    expect(base.payStep).toBe(0);
    selfHosted(copy);
    copy.homeLine = { id: "dsl-16", next: null };
    run(copy, 2);
    expect(mailDelay(copy)).toBe(72);
    const hour = copy.hour;
    const late = pay(copy);
    expect(late.payStep).toBe(0);
    expect(late.payAt! - hour).toBe(base.payAt! - s.hour + 72);
  });
});

describe("email orders", () => {
  it("cannot be switched on without a mail service", () => {
    const s = readyGame(6);
    s.marketing.owned = ["website", "orderForm"];
    expect(setEmailOrders(s, false).ok).toBe(true);
    s.company = { ...s.company, mail: { kind: "none" } };
    expect(err(setEmailOrders(s, true))).toBe("error.needsMail");
    bookMail(s, "hostedExchange");
    expect(setEmailOrders(s, true).ok).toBe(true);
  });

  it("bring no order leads without mail before the order form", () => {
    const orders = (mail: boolean) => {
      let n = 0;
      for (const seed of [1, 2, 3]) {
        const s = readyGame(seed);
        if (!mail) s.company = { ...s.company, mail: { kind: "none" } };
        run(s, 24 * 60);
        n += s.sales.requests.filter((r) => r.kind === "order").length;
      }
      return n;
    };
    expect(orders(true)).toBeGreaterThan(0);
    expect(orders(false)).toBe(0);
  }, 60_000);

  it("show the sales address on the site only with a mail service", async () => {
    const { siteContent } = await import("../src/sim/80-business/website");
    const s = readyGame(6);
    expect(siteContent(s).email).toBe(`sales@${s.company.domain}`);
    s.company = { ...s.company, mail: { kind: "none" } };
    expect(siteContent(s).email).toBeNull();
  });
});

describe("tutorial and saves", () => {
  it("checks the email step by a mail service of any kind", () => {
    const s = readyGame(7);
    s.company = { ...s.company, mail: { kind: "none" } };
    expect(CHECKS.email(s)).toBe(false);
    bookMail(s, "hostedExchange");
    expect(CHECKS.email(s)).toBe(true);
    selfHosted(s);
    expect(CHECKS.email(s)).toBe(true);
  });

  it("keeps the mail service through a save and defaults it to none in older saves", () => {
    const s = readyGame(7);
    expect(deserialize(serialize(s)).company.mail).toEqual(s.company.mail);
    const raw = JSON.parse(serialize(s));
    raw.company = { name: s.company.name, logo: s.company.logo, color: s.company.color };
    expect(deserialize(JSON.stringify(raw)).company.mail).toEqual({ kind: "none" });
  });
});
