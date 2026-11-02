import { describe, expect, it } from "vitest";
import { euroCents } from "../src/sim/00-core/money";
import { DOMAIN_OUT } from "../src/sim/30-customers/registrar";
import { monthlyValue, shownTemplates, templatesOf } from "../src/sim/40-support/tickets";
import { replyTicket } from "../src/sim/90-actions/support";
import { useTicketReplies } from "../src/ui/apps/browser/sites/desk/headless/useTicketReplies";
import { useTicketPane } from "../src/ui/apps/browser/sites/desk/headless/useTicketPane";
import { t } from "../src/i18n/en";
import { one, ticketOf } from "./support.helpers";

describe("ticket reply model", () => {
  it("howTo: short reply titles, every template with previews, Close", () => {
    const { s, cus, svc } = one(3);
    const tk = ticketOf(s, "howTo", "ftp", cus, svc);
    const m = useTicketReplies(s, tk);
    expect(m.templates!.map((x) => x.id)).toEqual(shownTemplates(s, tk, false));
    expect(m.templates!.every((x) => x.preview === null)).toBe(true);
    const all = useTicketReplies(s, tk, true);
    expect(all.templates!.map((x) => x.id)).toEqual(templatesOf(tk));
    expect(all.templates!.every((x) => !!x.preview)).toBe(true);
    expect(m).toMatchObject({ offers: null, transfer: false, actions: [], answers: [], close: t("support.close"), resolve: false, locked: false });
  });

  it("billing: credit carries a tenth of the monthly value", () => {
    const { s, cus, svc } = one(4);
    const tk = ticketOf(s, "billing", "charge", cus, svc);
    const credit = useTicketReplies(s, tk).actions.find((a) => a.id === "credit")!;
    expect(credit.amount).toBe(euroCents(monthlyValue(s.services, cus) * 0.1));
  });

  it("cancellation: retention offers with odds", () => {
    const { s, cus, svc } = one(5);
    const m = useTicketReplies(s, ticketOf(s, "cancellation", "leave", cus, svc));
    expect(m.offers!.length).toBeGreaterThan(0);
    expect(m.offers!.every((o) => o.title && o.value && o.oddsLabel)).toBe(true);
  });

  it("refund: reject reads Refuse and refund carries the monthly value", () => {
    const { s, cus, svc } = one(6);
    const m = useTicketReplies(s, ticketOf(s, "refund", "outage", cus, svc));
    expect(m.actions.find((a) => a.id === "reject")?.label).toBe(t("support.action.refuse"));
    expect(m.actions.find((a) => a.id === "refund")?.amount).toBe(euroCents(monthlyValue(s.services, cus)));
  });

  it("domain transfer: the answer form shows while open", () => {
    const { s, cus } = one(7);
    expect(useTicketReplies(s, ticketOf(s, "billing", DOMAIN_OUT, cus, null)).transfer).toBe(true);
  });

  it("a reply locks the panel and queues in the thread", () => {
    const { s, cus, svc } = one(8);
    const tk = ticketOf(s, "howTo", "ftp", cus, svc);
    expect(replyTicket(s, tk.id, "askDetails").ok).toBe(true);
    expect(useTicketReplies(s, tk).locked).toBe(true);
    const pane = useTicketPane(s, tk);
    expect(pane.items.map((i) => i.type)).toEqual(["opening", "event"]);
    expect(pane.customer?.name).toBe("Jonas Weber");
  });
});
