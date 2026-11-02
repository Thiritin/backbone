import { describe, expect, it } from "vitest";
import { DESK_ROUTE, DESKS, STATUS_LABELS, deskAiReady, deskById, featureYear, featuresAt, refToken, type DeskId } from "../src/sim/10-catalog/desks";
import { HIGH_VALUE_MONTHLY, priorityOf } from "../src/sim/40-support/desk";
import type { Customer, Service } from "../src/sim/30-customers/customers";
import type { TicketKind } from "../src/sim/40-support/tickets";
import { deskPages, deskPath, parseDesk } from "../src/sim/80-business/deskroutes";

const IDS = DESKS.map((d) => d.id);
const ARGS = { n: "4812", id: "7", view: "open", section: "email", folder: "2", log: "fetch" };
const desk = (id: DeskId) => deskById(id)!;

describe("desk catalog", () => {
  it("round-trips every page of every desk", () => {
    for (const id of IDS) for (const page of deskPages(id)) {
      const path = deskPath(id, page, ARGS);
      expect(parseDesk(id, path)?.page, `${id} ${page} ${path}`).toBe(page);
      for (const [k, v] of Object.entries(parseDesk(id, path)!.args)) expect(v).toBe(ARGS[k as keyof typeof ARGS]);
    }
  });

  it("reads a ticket, a queue and a folder from their addresses", () => {
    expect(parseDesk("ostickit", "/scp/tickets.php?id=178245")).toEqual({ page: "staffTicket", args: { n: "178245" } });
    expect(parseDesk("ostickit", "/scp/tickets.php?status=overdue")).toEqual({ page: "queue", args: { view: "overdue" } });
    expect(parseDesk("zendusk", "/hc/requests/new")?.page).toBe("hcNew");
    expect(parseDesk("freescoot", "/mailbox/settings/1")).toEqual({ page: "mailboxSettings", args: { id: "1" } });
    expect(parseDesk("freescoot", "/mailbox/1/2")).toEqual({ page: "folder", args: { id: "1", folder: "2" } });
    expect(parseDesk("ostickit", "/scp/nothing.php")).toBeNull();
  });

  it("rejects the paths of other desks", () => {
    for (const a of IDS) for (const b of IDS) {
      if (a === b) continue;
      const own = new Set(deskPages(b).map((p) => deskPath(b, p, ARGS)));
      for (const page of deskPages(a)) {
        const path = deskPath(a, page, ARGS);
        if (!own.has(path)) expect(parseDesk(b, path), `${path} on ${b}`).toBeNull();
      }
    }
  });

  it("puts each desk's number token in the subject", () => {
    expect(refToken(desk("ostickit"), "178245")).toBe("[#178245]");
    expect(refToken(desk("zendusk"), "4812")).toBe("[Request #4812]");
    expect(refToken(desk("freshdusk"), "1043")).toBe("[#1043]");
    expect(refToken(desk("freescoot"), "12")).toBe("");
    expect(refToken(desk("ostickit"), "")).toBe("");
    expect(desk("ostickit").ref).toMatchObject({ kind: "random", digits: 6 });
  });

  it("starts each feature in the researched year", () => {
    const years = (id: DeskId) => Object.fromEntries((["templates", "slaTimers", "customerSidebar", "reports", "merge", "rules", "portal"] as const).map((f) => [f, featureYear(desk(id), f)]));
    expect(years("ostickit")).toEqual({ templates: 2005, slaTimers: 2013, customerSidebar: 2014, reports: 2013, merge: 2019, rules: 2013, portal: 2005 });
    expect(years("zendusk")).toEqual({ templates: 2007, slaTimers: 2013, customerSidebar: 2007, reports: 2007, merge: 2010, rules: 2007, portal: 2007 });
    expect(years("freshdusk")).toEqual({ templates: 2011, slaTimers: 2011, customerSidebar: 2011, reports: 2011, merge: 2011, rules: 2011, portal: 2011 });
    expect(years("freescoot")).toEqual({ templates: null, slaTimers: null, customerSidebar: 2018, reports: null, merge: 2020, rules: null, portal: null });
    expect(featuresAt(desk("freescoot"), 2018)).toEqual(["filters", "search", "assign", "customerSidebar"]);
  });

  it("names a release for every self-hosted feature and a year for every hosted one", () => {
    for (const d of DESKS) for (const [f, at] of Object.entries(d.features)) {
      expect(typeof at, `${d.id} ${f}`).toBe(d.hosting === "self" ? "string" : "number");
      expect(featureYear(d, f as never)).toBeGreaterThanOrEqual(d.from);
    }
  });

  it("gives AI to the hosted desks only, from its real years", () => {
    for (const d of DESKS) {
      const first = Math.min(...Object.values(d.aiFrom));
      expect(d.features.ai ?? Infinity).toBe(d.hosting === "hosted" ? first : Infinity);
    }
    expect(deskAiReady(desk("zendusk"), "answerBot", 2016)).toBe(false);
    expect(deskAiReady(desk("zendusk"), "answerBot", 2017)).toBe(true);
    expect(deskAiReady(desk("freshdusk"), "answerBot", 2018)).toBe(true);
    for (const id of ["zendusk", "freshdusk"] as const) {
      expect(deskAiReady(desk(id), "autoAnswer", 2022)).toBe(false);
      expect(deskAiReady(desk(id), "autoAnswer", 2023)).toBe(true);
    }
    expect(deskAiReady(desk("ostickit"), "autoAnswer", 2026)).toBe(false);
  });

  it("routes customer kinds to desk departments and keeps the rest in their mailbox", () => {
    expect(DESK_ROUTE.outage).toEqual({ role: "support", dept: "support" });
    expect(DESK_ROUTE.refund).toEqual({ role: "support", dept: "billing" });
    expect(DESK_ROUTE.notice).toEqual({ role: "abuse", dept: "abuse" });
    expect(DESK_ROUTE.order).toEqual({ role: "sales", dept: null });
    expect(DESK_ROUTE.pear).toEqual({ role: "owner", dept: null });
  });

  it("labels every status in every desk", () => {
    expect(STATUS_LABELS.zendusk.escalated).toBe("onHold");
    expect(STATUS_LABELS.ostickit.waiting).toBe("answered");
    expect(STATUS_LABELS.freescoot.resolved).toBe("closed");
    for (const id of IDS) expect(Object.keys(STATUS_LABELS[id]).sort()).toEqual(["closed", "escalated", "new", "open", "resolved", "spam", "waiting"]);
  });

  it("derives the priority from the kind and the customer", () => {
    const c = (id: string, profile: Customer["profile"]) => ({ id, profile }) as Customer;
    const s = { customers: [c("big", "enterprise"), c("small", "private")], services: [] as Service[] };
    const p = (kind: TicketKind, customerId = "small", topic = "") => priorityOf(s, { kind, customerId, topic });
    expect(p("outage", "big")).toBe("urgent");
    expect(p("outage")).toBe("high");
    expect(p("appeal")).toBe("high");
    expect(p("legal", "small", "takedown")).toBe("high");
    expect(p("legal", "small", "data")).toBe("normal");
    expect(p("howTo")).toBe("low");
    expect(p("billing")).toBe("normal");
    expect(p("cancellation")).toBe("normal");
    s.services = [{ customerId: "small", period: "year", price: HIGH_VALUE_MONTHLY * 12, endedAt: null } as unknown as Service];
    expect(p("cancellation")).toBe("high");
    expect(priorityOf(s, { kind: "howTo", customerId: "small", topic: "", priority: "urgent" })).toBe("urgent");
  });
});
