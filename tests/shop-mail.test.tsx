import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { PREFERENCE } from "../src/sim/10-catalog/payments";
import { orderLead } from "../src/sim/30-market/orders";
import type { GameState } from "../src/sim/50-state";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { orderFor } from "../src/sim/80-business/shop-orders";
import { suspendService, terminateService, unsuspendService } from "../src/sim/90-actions/holds";
import { changeServicePassword, resendWelcome, setMailTemplate } from "../src/sim/90-actions/shop-orders";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { automate } from "./fixtures";
import { shopGame } from "./portal-helpers";

const saved = PREFERENCE.private;
beforeEach(() => { PREFERENCE.private = { transfer: 1 }; });
afterEach(() => { PREFERENCE.private = saved; });

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };
const sold = (s: GameState) => {
  const r = orderLead(s, "private", "Frankfurt", [], web, false);
  return s.services.find((v) => v.id === orderFor(s, r.id)!.items[0].serviceId)!;
};
const sent = (s: GameState) => s.shop.emails.map((m) => m.template);

describe("shop emails", () => {
  it("confirm the order, welcome with the access data and send the invoice", () => {
    const s = automate(shopGame("whmCache")), v = sold(s);
    expect(sent(s)).toEqual(["orderConfirmation", "invoiceCreated", "welcome"]);
    expect(s.shop.emails.every((m) => m.customerId === v.customerId)).toBe(true);
    const welcome = s.shop.emails.find((m) => m.template === "welcome")!;
    expect(welcome.params).toMatchObject({ password: v.password, service: v.label });
    expect(t("shop-mail.welcome.body", welcome.params)).toContain(v.password!);
    expect(v.accessSent).toBe(true);
  });

  it("leave the access data owed while the Welcome Email is off, until it is resent", () => {
    const s = automate(shopGame("whmCache"));
    expect(setMailTemplate(s, "welcome", false).ok).toBe(true);
    const v = sold(s);
    expect(sent(s)).not.toContain("welcome");
    expect(s.services.find((x) => x.id === v.id)!.accessSent).toBe(false);
    expect(resendWelcome(s, v.id)).toMatchObject({ ok: false, error: "error.templateOff" });
    setMailTemplate(s, "welcome", true);
    expect(resendWelcome(s, v.id).ok).toBe(true);
    expect(s.services.find((x) => x.id === v.id)!.accessSent).toBe(true);
  });

  it("tell shop customers about holds, a new password and the cancellation, and nobody else", () => {
    const s = automate(shopGame("whmCache")), v = sold(s), before = s.shop.emails.length;
    suspendService(s, v.id);
    unsuspendService(s, v.id);
    changeServicePassword(s, v.id);
    terminateService(s, v.id, "notice", null);
    expect(sent(s).slice(before)).toEqual(["suspension", "unsuspension", "passwordChanged", "cancellation"]);
    const books = s.services.find((x) => x.endedAt === null && x.customerId !== v.customerId)!, n = s.shop.emails.length;
    suspendService(s, books.id);
    expect(s.shop.emails.length).toBe(n);
  });

  it("keep the log and the switched-off templates through a save, and give old saves none", () => {
    const s = automate(shopGame("whmCache"));
    sold(s);
    setMailTemplate(s, "quote", false);
    const back = deserialize(serialize(s));
    expect(back.shop.emails).toEqual(s.shop.emails);
    expect(back.shop.mailOff).toEqual(["quote"]);
    const old = JSON.parse(serialize(s));
    delete old.shop.emails;
    delete old.shop.mailOff;
    expect(deserialize(JSON.stringify(old)).shop).toMatchObject({ emails: [], mailOff: [] });
  });

  it("show the log with the opened subjects in the admin and on the client page", () => {
    const s = automate(shopGame("whmCache")), v = sold(s), Admin = skinOf("whmCache").Admin;
    const page = (q: Record<string, string>) => renderToString(<Admin game={s} variant="whmCache" route={parsePortal("whmCache", portalPath("whmCache", "admin", {}, q))!} open={() => {}} version="" major="" browse={() => {}} />);
    expect(page({ s: "emails" })).toContain("Hosting Account Welcome Email");
    expect(page({ s: "emails" })).toContain("New Account Information");
    expect(page({ s: "client", id: v.customerId })).toContain("Customer Invoice");
    expect(page({ s: "service", id: v.id })).toContain("Resend Welcome Email");
  });
});
