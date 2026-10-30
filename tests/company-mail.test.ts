import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { MAIL_PROVIDERS, mailDelay, mailImpaired, mailShare, providerById, salesAddress, seatsFor } from "../src/sim/80-business/mail";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { newGame } from "../src/sim/50-state";
import { createVm } from "../src/sim/90-actions/clusters";
import { bookMail, cancelMail, selectMailServer } from "../src/sim/90-actions/mail";
import { signRegistrar, registerCompanyDomain } from "../src/sim/90-actions/registrar";
import { installBlock, installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { hire } from "../src/sim/90-actions/staff";
import { setEmailOrders } from "../src/sim/90-actions/website";
import { CHECKS } from "../src/sim/checklist";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { bootedMachine, readyGame } from "./fixtures";
import { err, idOf, run, toMonthStart, mailLedger, selfHosted } from "./company-mail.helpers";

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
    expect(s.company.mail).toEqual({ kind: "free" });
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
    const vm = bootedMachine(s, idOf(createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 1, ramGb: 2, diskGb: 40 })));
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

  it("allows one mail server per company and a panel next to it", () => {
    const s = readyGame(3);
    selfHosted(s);
    const vm2 = idOf(createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 1, ramGb: 2, diskGb: 40 }));
    expect(installBlock(s, vm2, "postfixit")).toBe("error.oneMailServer");
    const mine = s.clusters.find((c) => c.kind === "mail")!.vm!;
    expect(installBlock(s, mine, "freepanel")).toBeNull();
  });

  it("is on sale from its year and installs Mailpig from 2015", () => {
    const s = readyGame(3);
    s.hour = hourOf(new Date(Date.UTC(2015, 0, 5)));
    const id = selfHosted(s, "mailpig");
    expect(s.clusters.find((c) => c.id === id)).toMatchObject({ kind: "mail", panel: "mailpig" });
  });

  it("goes back to free mail when the server is uninstalled", () => {
    const s = readyGame(3);
    selfHosted(s);
    const vm = s.clusters.find((c) => c.kind === "mail")!.vm!;
    expect(uninstallSoftware(s, vm).ok).toBe(true);
    expect(s.company.mail).toEqual({ kind: "free" });
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

describe("email orders", () => {
  it("start on free Notmail without a domain and keep arriving", () => {
    const s = newGame(1);
    expect(s.company.mail).toEqual({ kind: "free" });
    expect(salesAddress(s)).toBe("basement-hosting@notmail.com");
    let n = 0;
    for (const seed of [1, 2, 3]) {
      const g = readyGame(seed);
      g.company = { ...g.company, mail: { kind: "free" } };
      run(g, 24 * 60);
      n += g.sales.requests.filter((r) => r.kind === "order").length;
    }
    expect(n).toBeGreaterThan(0);
  }, 60_000);

  it("lose half of the business email orders on free mail and none of the private ones", () => {
    const s = readyGame(6);
    s.company = { ...s.company, mail: { kind: "free" } };
    expect(mailShare(s, "private")).toBe(1);
    expect(mailShare(s, "gamer")).toBe(1);
    expect(mailShare(s, "smallBiz")).toBe(0.5);
    expect(mailShare(s, "enterprise")).toBe(0.5);
    bookMail(s, "hostedExchange");
    expect(mailShare(s, "smallBiz")).toBe(1);
    const orders = (free: boolean) => {
      let n = 0;
      for (const seed of [1, 2, 3]) {
        const g = readyGame(seed);
        if (free) g.company = { ...g.company, mail: { kind: "free" } };
        run(g, 24 * 60);
        n += g.sales.requests.filter((r) => r.kind === "order" && r.profile !== "private" && r.profile !== "gamer" && r.profile !== "hobbyDev").length;
      }
      return n;
    };
    expect(orders(true)).toBeLessThan(orders(false));
  }, 120_000);

  it("can be switched on with free mail", () => {
    const s = readyGame(6);
    s.marketing.owned = ["website", "orderForm"];
    s.company = { ...s.company, mail: { kind: "free" } };
    expect(setEmailOrders(s, false).ok).toBe(true);
    expect(setEmailOrders(s, true).ok).toBe(true);
  });

  it("show the free address on the site until mail runs under the domain", async () => {
    const { siteContent } = await import("../src/sim/80-business/website");
    const s = readyGame(6);
    expect(siteContent(s).email).toBe(`sales@${s.company.domain}`);
    s.company = { ...s.company, mail: { kind: "free" } };
    expect(siteContent(s).email).toBe(salesAddress(s));
    expect(siteContent(s).email).toMatch(/@notmail\.com$/);
  });
});

describe("tutorial and saves", () => {
  it("checks the email step by an upgrade from free mail", () => {
    const s = readyGame(7);
    s.company = { ...s.company, mail: { kind: "free" } };
    expect(CHECKS.email(s)).toBe(false);
    bookMail(s, "hostedExchange");
    expect(CHECKS.email(s)).toBe(true);
    selfHosted(s);
    expect(CHECKS.email(s)).toBe(true);
  });

  it("keeps the mail service through a save and gives older saves free mail", () => {
    const s = readyGame(7);
    expect(deserialize(serialize(s)).company.mail).toEqual(s.company.mail);
    const raw = JSON.parse(serialize(s));
    raw.company = { name: s.company.name, logo: s.company.logo, color: s.company.color };
    expect(deserialize(JSON.stringify(raw)).company.mail).toEqual({ kind: "free" });
    raw.company.mail = { kind: "none" };
    expect(deserialize(JSON.stringify(raw)).company.mail).toEqual({ kind: "free" });
  });
});
