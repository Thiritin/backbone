import { describe, expect, it } from "vitest";
import { hourOf, isMonthStart } from "../src/sim/00-core/time";
import { registrarById, tierFor } from "../src/sim/10-catalog/registrars";
import { companyDomain, derivedDomain } from "../src/sim/30-customers/domains";
import { monthlyDomains, spinNames, wholesale, yearlyAt } from "../src/sim/30-customers/registrar";
import { registrarUrl, resolve } from "../src/sim/80-business/browser";
import { domainOf, extend, register, registryCost } from "../src/sim/30-customers/registry";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { orderCompanyDomain, queueTransfer, registerCompanyDomain, signRegistrar, transferDomains } from "../src/sim/90-actions/registrar";
import { hire, setTechLocation } from "../src/sim/90-actions/staff";
import { launchSite, setLine } from "../src/sim/90-actions/website";
import { CHECKS, checkDone, TUTORIAL } from "../src/sim/checklist";
import { setCompany } from "../src/sim/90-actions/company";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame, registered, newGame } from "./fixtures";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const toMonthStart = (s: GameState) => { do tick(s); while (!isMonthStart(s.hour)); };
const domainLedger = (s: GameState) => s.ledger.filter((e) => e.hour === s.hour && e.category === "domains");
const sum = (xs: { amount: number }[]) => Math.round(xs.reduce((n, e) => n + e.amount, 0) * 100) / 100;
const many = (s: GameState, n: number, from = 0) => { for (let i = from; i < from + n; i++) register(s, `kunde${i}.de`, "cus-test", false); };

describe("wholesale", () => {
  it("is the registry cost times the partner's factor for the tier", () => {
    const s = readyGame(1);
    expect(wholesale(s, "a.de")).toBe(18);
    s.registrar = { id: "goDuddy", since: 0, tier: 0, billed: true, transfer: null };
    expect(wholesale(s, "a.de")).toBe(15.6);
    s.registrar!.tier = 3;
    expect(wholesale(s, "a.de")).toBe(13.2);
    s.registrar = { id: "openSrsly", since: 0, tier: 1, billed: true, transfer: null };
    expect(wholesale(s, "a.at")).toBe(28.75);
  });

  it("charges InterNetY the registry cost for .de in every tier", () => {
    const s = readyGame(1);
    for (const tier of [0, 1, 2, 3]) {
      s.registrar = { id: "interNetY", since: 0, tier, billed: true, transfer: null };
      expect(wholesale(s, "a.de")).toBe(12);
      expect(wholesale(s, "a.at")).toBeGreaterThan(25);
    }
  });

  it("adds the ICANN fee to a .com, 0.18 and from July 2025 0.20", () => {
    const s = readyGame(1);
    expect(wholesale(s, "a.com")).toBe(9.18);
    s.hour = hourOf(new Date(Date.UTC(2025, 5, 1)));
    expect(wholesale(s, "a.com")).toBeCloseTo(registryCost("a.com", 2025) * 1.5 + 0.18, 2);
    s.hour = hourOf(new Date(Date.UTC(2025, 7, 1)));
    expect(wholesale(s, "a.com")).toBeCloseTo(registryCost("a.com", 2025) * 1.5 + 0.2, 2);
  });

  it("is zero without a contract", () => {
    expect(wholesale(newGame(1), "a.de")).toBe(0);
  });
});

describe("tiers", () => {
  it("fall at 100, 500 and 5,000 domains", () => {
    expect([0, 99, 100, 499, 500, 4999, 5000].map(tierFor)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it("follow the count of domains under management at the month start", () => {
    const s = readyGame(2);
    s.registrar = { id: "goDuddy", since: 0, tier: 0, billed: true, transfer: null };
    many(s, 120);
    expect(s.registrar!.tier).toBe(0);
    toMonthStart(s);
    expect(s.registrar!.tier).toBe(1);
    expect(domainLedger(s).find((e) => e.key === "ledger.domains")!.amount).toBeCloseTo(-(121 * 12 * 1.2) / 12, 1);
    s.domains = s.domains.slice(0, 20);
    toMonthStart(s);
    expect(s.registrar!.tier).toBe(0);
  });
});

describe("monthly billing", () => {
  it("is one twelfth of every domain's wholesale and books nothing at registration", () => {
    const s = readyGame(3), cash = s.cash;
    register(s, "kunde.de", "cus-test", false);
    expect(s.cash).toBe(cash);
    extend(s, "kunde.de");
    expect(s.cash).toBe(cash);
    expect(domainOf(s, "kunde.de")!.expiresAt).toBeGreaterThan(8760);
    expect(monthlyDomains(s)).toBe(3);
    toMonthStart(s);
    const lines = domainLedger(s);
    expect(lines.map((e) => e.key)).toEqual(["ledger.domains"]);
    expect(sum(lines)).toBe(-3);
  });

  it("adds the signup once and the fee every month", () => {
    const s = readyGame(3);
    expect(signRegistrar(s, "goDuddy").ok).toBe(true);
    expect(s.cash).toBeGreaterThan(0);
    toMonthStart(s);
    const first = domainLedger(s);
    expect(first.map((e) => e.key).sort()).toEqual(["ledger.domains", "ledger.registrar"]);
    expect(sum(first)).toBeCloseTo(-(9 + (15.6 / 12)), 2);
    s.registrar = { ...s.registrar!, transfer: null };
    signRegistrar(s, "openSrsly");
    toMonthStart(s);
    expect(domainLedger(s).map((e) => e.key).sort()).toEqual(["ledger.domains", "ledger.registrarSignup"]);
    expect(sum(domainLedger(s))).toBeCloseTo(-(100 + 15 / 12), 2);
    toMonthStart(s);
    expect(domainLedger(s).map((e) => e.key)).toEqual(["ledger.domains"]);
  });

  it("charges InterNetY the minimum in total, the unused part as a fee", () => {
    const s = readyGame(3);
    expect(signRegistrar(s, "interNetY").ok).toBe(true);
    toMonthStart(s);
    expect(sum(domainLedger(s))).toBe(-(200 + 50));
    toMonthStart(s);
    expect(sum(domainLedger(s))).toBe(-50);
    expect(domainLedger(s).find((e) => e.key === "ledger.domains")!.amount).toBe(-1);
    many(s, 60);
    toMonthStart(s);
    expect(sum(domainLedger(s))).toBeCloseTo(-(61 * 12) / 12, 2);
    expect(domainLedger(s).map((e) => e.key)).toEqual(["ledger.domains"]);
  });

  it("takes the cash with the ledger", () => {
    const s = readyGame(4), cash = s.cash, before = s.ledger.length;
    toMonthStart(s);
    const booked = sum(s.ledger.slice(before).filter((e) => e.category === "domains"));
    expect(booked).toBeLessThan(0);
    expect(s.cash).toBeLessThanOrEqual(cash + booked);
  });
});

describe("signing and switching", () => {
  it("signs the first contract without a transfer", () => {
    const s = newGame(1);
    expect(err(signRegistrar(s, "nope"))).toBe("error.unknownRegistrar");
    expect(signRegistrar(s, "nameCheep").ok).toBe(true);
    expect(s.registrar).toMatchObject({ id: "nameCheep", tier: 0, billed: false, transfer: null });
    expect(err(signRegistrar(s, "nameCheep"))).toBe("error.registrarCurrent");
  });

  it("transfers every domain as a hand task of five minutes each", () => {
    const s = readyGame(5);
    many(s, 11);
    expect(signRegistrar(s, "openSrsly").ok).toBe(true);
    expect(s.registrar!.transfer).toEqual({ from: "nameCheep", domains: 12, doneAt: null });
    expect(err(signRegistrar(s, "goDuddy"))).toBe("error.transferBusy");
    expect(s.domains.every((d) => !d.lapsed)).toBe(true);
    const start = s.hour * 60;
    expect(transferDomains(s).ok).toBe(true);
    expect(s.playerBusyUntil).toBe(start + 60);
    expect(s.registrar!.transfer!.doneAt).toBe(s.hour + 1);
    tick(s);
    tick(s);
    expect(s.registrar!.transfer).toBeNull();
    expect(err(transferDomains(s))).toBe("error.noTransfer");
  });

  it("lets a technician trained on panels move the domains", () => {
    const s = readyGame(5);
    s.staff = [];
    expect(signRegistrar(s, "openSrsly").ok).toBe(true);
    expect(err(queueTransfer(s))).toBe("error.noTechnician");
    const hired = hire(s, visibleCandidates(s).find((c) => c.role === "technician")!.id), id = hired.ok ? hired.id! : "";
    s.staff = s.staff.map((e) => (e.id === id ? { ...e, trained: ["hardware", "servers", "panels"] } : e));
    setTechLocation(s, id, s.locations[0].id);
    expect(queueTransfer(s).ok).toBe(true);
    expect(err(queueTransfer(s))).toBe("error.alreadyQueued");
    s.hour = 48 + 9 - 1;
    const events = [...tick(s), ...tick(s), ...tick(s)];
    expect(s.techOps).toEqual([]);
    expect(s.registrar!.transfer).toBeNull();
    expect(events.filter((e) => e.key === "event.domainsTransferred")).toHaveLength(1);
  });
});

describe("company domain", () => {
  it("needs a contract and a valid, free name", () => {
    const s = newGame(1);
    expect(err(registerCompanyDomain(s, "basement-hosting.de"))).toBe("error.needsRegistrar");
    signRegistrar(s, "nameCheep");
    for (const bad of ["ab.de", "-abc.de", "abc-.de", "a b c.de", "abc.xyz", "abc", "umlautä.de", `${"a".repeat(41)}.de`]) expect(err(registerCompanyDomain(s, bad))).toBe("error.domainInvalid");
    register(s, "taken.de", "cus-test", false);
    expect(err(registerCompanyDomain(s, "taken.de"))).toBe("error.domainTaken");
    for (const other of ["yahoy.com", "namecheep.com", "internety.de", "youtub.com"]) expect(err(registerCompanyDomain(s, other))).toBe("error.domainTaken");
    expect(registerCompanyDomain(s, "  Basement-Hosting.de ").ok).toBe(true);
    expect(s.company.domain).toBe("basement-hosting.de");
    expect(domainOf(s, "basement-hosting.de")).toMatchObject({ customerId: null, transfer: false, lapsed: false });
    expect(err(registerCompanyDomain(s, "other.de"))).toBe("error.companyDomainOwned");
  });

  it("joins the domains under management and renews with the contract", () => {
    const s = readyGame(6), name = s.company.domain!;
    expect(monthlyDomains(s)).toBe(1.5);
    s.domains = s.domains.map((d) => (d.name === name ? { ...d, expiresAt: s.hour + 100 } : d));
    toMonthStart(s);
    expect(domainOf(s, name)!.expiresAt).toBeGreaterThan(8760);
    expect(s.domains.find((d) => d.name === name)!.lapsed).toBe(false);
  });

  it("falls back to the derived name until one is owned", () => {
    const s = newGame(1);
    expect(companyDomain(s)).toBe(derivedDomain(s));
    s.company = { ...s.company, domain: "mine.de" };
    expect(companyDomain(s)).toBe("mine.de");
  });

  it("is needed to put the website and its lines online", () => {
    const s = readyGame(7);
    s.company = { ...s.company, domain: null };
    s.marketing = { ...s.marketing, lines: [], launched: false };
    expect(err(setUpChannel(s, "website"))).toBe("error.needsLaunch");
    expect(err(setLine(s, "webHosting", true))).toBe("error.needsLaunch");
    expect(err(launchSite(s, { kind: "rented" }))).toBe("error.needsDomain");
    s.company = { ...s.company, domain: "mine.de" };
    expect(launchSite(s, { kind: "rented" }).ok).toBe(true);
    expect(setUpChannel(s, "website").ok).toBe(true);
    expect(setLine(s, "webHosting", true).ok).toBe(true);
  });
});

describe("tutorial", () => {
  it("runs bank, register, company, buyServer, mountServer, mountRouter, internet, setup, website, domain, launch, email, firstCustomer", () => {
    expect(TUTORIAL).toEqual(["bank", "register", "company", "buyServer", "mountServer", "mountRouter", "internet", "setup", "website", "domain", "launch", "email", "firstCustomer"]);
  });

  it("starts without Marketing and gives it to old registered saves", () => {
    const s = registered(newGame(1));
    expect(s.installed).not.toContain("Marketing");
    const raw = JSON.parse(serialize(s));
    delete raw.registration;
    delete raw.arrived;
    raw.installed = raw.installed.filter((id: string) => id !== "Marketing");
    expect(deserialize(JSON.stringify(raw)).installed).toContain("Marketing");
  });

  it("buys the company domain with a new contract in one step", () => {
    const s = newGame(1);
    expect(orderCompanyDomain(s, "nameCheep", "no").ok).toBe(false);
    expect(s.registrar).toBeNull();
    expect(orderCompanyDomain(s, "nameCheep", " Basement-Hosting.de ").ok).toBe(true);
    expect(s.registrar?.id).toBe("nameCheep");
    expect(s.company.domain).toBe("basement-hosting.de");
    expect(CHECKS.domain(s)).toBe(true);
    expect(orderCompanyDomain(s, "nameCheep", "other.de").ok).toBe(false);
  });

  it("buys the domain only on the site of the signed registrar", () => {
    const s = newGame(1);
    signRegistrar(s, "goDuddy");
    expect(err(orderCompanyDomain(s, "nameCheep", "basement-hosting.de"))).toBe("error.registrarOther");
    expect(orderCompanyDomain(s, "goDuddy", "basement-hosting.de").ok).toBe(true);
    expect(s.registrar?.id).toBe("goDuddy");
  });

  it("ticks the company step on a saved company change", () => {
    const s = newGame(1);
    expect(checkDone(s, "company")).toBe(false);
    expect(setCompany(s, { name: "" }).ok).toBe(false);
    expect(checkDone(s, "company")).toBe(false);
    expect(setCompany(s, { name: "Cellar Hosting" }).ok).toBe(true);
    expect(checkDone(s, "company")).toBe(true);
  });

  it("checks the website step by a built site and the launch step by a launched site with a listed product", () => {
    const s = { ...newGame(1), cash: 10_000 };
    s.company = { ...s.company, domain: "mine.de" };
    s.marketing = { ...s.marketing, lines: ["webHosting"], siteReady: 0 };
    expect(CHECKS.website(s)).toBe(true);
    expect(CHECKS.launch(s)).toBe(false);
    expect(launchSite(s, { kind: "rented" }).ok).toBe(true);
    expect(CHECKS.launch(s)).toBe(true);
  });

  it("checks the domain step by a contract and an owned company domain", () => {
    const s = newGame(1);
    expect(CHECKS.domain(s)).toBe(false);
    signRegistrar(s, "nameCheep");
    expect(CHECKS.domain(s)).toBe(false);
    registerCompanyDomain(s, "basement-hosting.de");
    expect(CHECKS.domain(s)).toBe(true);
  });
});

describe("old saves", () => {
  it("load with the derived domain registered at NameCheep and the contract signed", () => {
    const s = readyGame(8);
    const raw = JSON.parse(serialize(s));
    delete raw.registrar;
    raw.company = { name: s.company.name, logo: s.company.logo, color: s.company.color };
    raw.domains = [];
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.registrar).toMatchObject({ id: "nameCheep", tier: 0, billed: true, transfer: null });
    expect(loaded.company).toMatchObject({ domain: "basement-hosting.de", mail: { kind: "free" } });
    expect(domainOf(loaded, "basement-hosting.de")).toMatchObject({ customerId: null });
    expect(registrarById(loaded.registrar!.id)!.signup).toBe(0);
  });

  it("keep a saved contract and company as they are", () => {
    const s = readyGame(8);
    signRegistrar(s, "interNetY");
    const loaded = deserialize(serialize(s));
    expect(loaded.registrar).toEqual(s.registrar);
    expect(loaded.company).toEqual(s.company);
    expect(loaded.domains).toEqual(s.domains);
  });

  it("do not register a domain again for a saved game without a contract", () => {
    const s = newGame(9);
    const loaded = deserialize(serialize(s));
    expect(loaded.registrar).toBeNull();
    expect(loaded.company.domain).toBeNull();
    expect(loaded.domains).toEqual([]);
  });
});

describe("registrar sites", () => {
  it("spins the typed name across TLDs and variations", () => {
    const names = spinNames(" Basement Hosting.de ");
    expect(names[0]).toBe("basement-hosting.de");
    expect(names).toContain("basement-hosting.com");
    expect(names).toContain("getbasement.de");
    expect(names).toContain("basementweb.de");
    expect(new Set(names).size).toBe(names.length);
    expect(spinNames("acme")[0]).toBe("acme.com");
    expect(spinNames("  !! ")).toEqual([]);
  });

  it("prices a search at the registrar's own factor", () => {
    const s = readyGame(1);
    expect(yearlyAt(s, registrarById("goDuddy")!, 0, "a.de")).toBe(15.6);
    expect(yearlyAt(s, registrarById("nameCheep")!, 0, "a.de")).toBe(wholesale(s, "a.de"));
  });

  it("serves each registrar's site and bookmarks the one under contract", () => {
    const s = newGame(1);
    expect(registrarUrl(s)).toBe("www.namecheep.com/");
    expect(resolve(s, "goduddy.com").page).toEqual({ kind: "registrar", id: "goDuddy" });
    signRegistrar(s, "openSrsly");
    expect(registrarUrl(s)).toBe("www.opensrsly.com/");
    expect(resolve(s, registrarUrl(s)).page).toEqual({ kind: "registrar", id: "openSrsly" });
  });
});
