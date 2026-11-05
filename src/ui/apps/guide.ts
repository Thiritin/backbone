import { inLetterbox } from "../../sim/40-support/letters";
import { isOfficeRouter, modelById } from "../../sim/10-catalog/hardware";
import { overdue } from "../../sim/46-finance/payables";
import { locationOf } from "../../sim/60-infra/status";
import { addressOf, FRITZ_HOST } from "../../sim/60-infra/lan";
import { registrarById, REGISTRARS } from "../../sim/10-catalog/registrars";
import { supportApp } from "./support/desk";
import { t } from "../../i18n/en";
import { OFFICE_URL } from "../../sim/80-business/office";
import { bankUrl, dirSlug, displayHost, HOME_URL, registrarUrl } from "../../sim/80-business/browser";
import { mailSiteUrl } from "../../sim/10-catalog/mail-consumer";
import { HOSTTOAST_HOST } from "../../sim/10-catalog/hosttoast";
import { FLYER_HOST } from "../../sim/10-catalog/flyers";
import type { GameState } from "../../sim/50-state";
import { SITES } from "../../sim/10-catalog/sites";
import { nextGoal, waiting, type Card, type Goal } from "../../sim/checklist";

export type StepId = Goal;
export interface Step { title: string; text: string; app: string; focus?: { kind: string; id: string } }

// The Wikipedio article that explains a step.
export const STEP_WIKI: Partial<Record<StepId, string>> = {
  mountServer: "Rack_unit", setup: "Server_installation",
  domain: "Domain_name", launch: "Web_hosting", email: "Email_blacklist",
};

const basement = (s: GameState) => s.locations.find((l) => l.space === "basement") ?? s.locations[0];
const firstServer = (s: GameState) => s.devices.find((d) => modelById(d.model).kind === "server");

// The order's own email or ticket, when one is open; Support routes it to the desk or to Pear Mail.
const orderAt = (s: GameState, fallback: string): Pick<Step, "app" | "focus"> => {
  const r = s.sales.requests.find((x) => x.kind === "order" && !x.shop && x.ticketId && x.status !== "lost" && x.status !== "declined");
  return r ? { app: "Support", focus: { kind: "ticket", id: r.ticketId! } } : { app: fallback };
};

// Where each tutorial step happens and what the Open button shows there.
export function stepOf(s: GameState, id: StepId): Step {
  const home = basement(s), server = firstServer(s);
  // Customer mail is read in the support desk, or the provider's inbox for an external mail plan; otherwise in Pear Mail.
  const mail = supportApp(s), inSupport = !!s.desk || s.company.mail.kind === "external", mailApp = s.desk ? mail.name : inSupport ? mail.brand : "Pear Mail", mailWin = inSupport ? "Support" : "Pear Mail";
  switch (id) {
    case "bank":
      return { title: t("guide.step.bank"), text: t("apps.guide.step.bank"), app: "Browser", focus: { kind: "url", id: bankUrl("sparklasse") } };
    case "register":
      return { title: t("guide.step.register"), text: t("apps.guide.step.register"), app: "Browser", focus: { kind: "url", id: OFFICE_URL } };
    case "mail": {
      const box = s.mail.accounts.find((a) => a.id === s.mail.primary);
      if (!s.registration || !box) return { title: t("guide.step.mail"), text: t("apps.guide.step.mailPending"), app: "Browser", focus: { kind: "url", id: OFFICE_URL } };
      return { title: t("guide.step.mail"), text: t("apps.guide.step.mail", { address: `${box.local}@${box.domain}` }), app: "Pear Mail" };
    }
    case "payBill": {
      const box = inLetterbox(s)[0];
      return { title: t("guide.step.payBill"), text: t("apps.guide.step.payBill"), app: "Post", focus: box ? { kind: "letterbox", id: box.box! } : { kind: "bill", id: "" } };
    }
    case "payBills": {
      const late = s.payables.find((p) => overdue(s, p) && p.sent < p.amount - 0.005) ?? s.payables.find((p) => p.paidAt === null);
      return { title: t("guide.step.payBills"), text: t("apps.guide.step.payBills"), app: "Books", focus: late && { kind: "payable", id: late.id } };
    }
    case "books":
      return { title: t("guide.step.books"), text: t("apps.guide.step.books"), app: "Browser", focus: { kind: "url", id: `${HOME_URL}${dirSlug(t("sim.index.cat.bookkeeping"))}` } };
    case "buyServer":
      return { title: t("guide.step.buyServer"), text: t("apps.guide.step.buyServer"), app: "Shop", focus: { kind: "class", id: "server" } };
    case "mountServer":
      return { title: t("guide.step.mountServer"), text: t("apps.guide.step.mountServer"), app: "Locations", focus: home && { kind: "location", id: home.id } };
    case "mountRouter": {
      const router = s.devices.find((d) => isOfficeRouter(modelById(d.model)) && ((d.store ?? locationOf(s, d)?.id) === home?.id));
      return { title: t("guide.step.mountRouter"), text: t("apps.guide.step.mountRouter"), app: "Locations", focus: router ? { kind: "device", id: router.id } : home && { kind: "location", id: home.id } };
    }
    case "serverLinked":
      return { title: t("guide.step.serverLinked"), text: t("apps.guide.step.serverLinked"), app: "Locations", focus: server && { kind: "device", id: server.id } };
    case "downloadIso":
      return { title: t("guide.step.downloadIso"), text: t("apps.guide.step.downloadIso"), app: "Browser", focus: { kind: "url", id: `${displayHost(SITES.lunix.host)}/download` } };
    case "writeStick":
      return { title: t("guide.step.writeStick"), text: t("apps.guide.step.writeStick"), app: "Applications", focus: { kind: "folder", id: "downloads" } };
    case "plugStick":
      return { title: t("guide.step.plugStick"), text: t("apps.guide.step.plugStick"), app: "Locations", focus: server && { kind: "device", id: server.id } };
    case "bootUsb":
      return { title: t("guide.step.bootUsb"), text: t("apps.guide.step.bootUsb"), app: "Locations", focus: server && { kind: "device", id: server.id } };
    case "installOs":
      return { title: t("guide.step.installOs"), text: t("apps.guide.step.installOs"), app: "Locations", focus: server && { kind: "device", id: server.id } };
    case "setup":
      return { title: t("guide.step.setup"), text: t("apps.guide.step.setup"), app: "Terminal", focus: server && { kind: "ssh", id: addressOf(s, server.id) ?? server.hostname ?? server.id } };
    case "shareWeb":
      return { title: t("guide.step.shareWeb"), text: t("apps.guide.step.shareWeb"), app: "Browser", focus: { kind: "url", id: `${FRITZ_HOST}/` } };
    case "domain": {
      const partner = (s.registrar && registrarById(s.registrar.id)?.name) ?? REGISTRARS[0].name;
      return {
        title: t("guide.step.domain"),
        text: t("apps.guide.step.domain", { partner }),
        app: "Browser",
        focus: { kind: "url", id: registrarUrl(s) },
      };
    }
    case "website":
      // Marketing is installed from the software shelf first.
      return s.installed.includes("Marketing")
        ? { title: t("guide.step.website"), text: t("apps.guide.step.website"), app: "Marketing", focus: { kind: "page", id: "website" } }
        : { title: t("guide.step.website"), text: t("apps.guide.step.website"), app: "Shop", focus: { kind: "software", id: "Marketing" } };
    case "launch":
      return { title: t("guide.step.launch"), text: t("apps.guide.step.launch"), app: "Marketing", focus: { kind: "page", id: "website" } };
    case "email":
      return { title: t("guide.step.email"), text: t("apps.guide.step.email"), app: "Browser", focus: { kind: "url", id: mailSiteUrl("ionose") } };
    case "hosttoast":
      return { title: t("guide.step.hosttoast"), text: t("apps.guide.step.hosttoast"), app: "Browser", focus: { kind: "url", id: `www.${HOSTTOAST_HOST}/` } };
    case "flyers":
      return { title: t("guide.step.flyers"), text: t("apps.guide.step.flyers"), app: "Browser", focus: { kind: "url", id: `${displayHost(FLYER_HOST)}/` } };
    case "firstCustomer":
      return { title: t("guide.step.firstCustomer"), text: t("apps.guide.step.firstCustomer", { app: mailApp }), ...orderAt(s, mailWin) };
    case "orderAccount":
    case "orderProvision":
    case "orderAccess":
      return { title: t(`guide.step.${id}`), text: t(`apps.guide.step.${id}`, { app: mailApp }), ...orderAt(s, mailWin) };
    case "orderDomain":
      return { title: t("guide.step.orderDomain"), text: t("apps.guide.step.orderDomain", { app: mailApp }), app: "Browser", focus: { kind: "url", id: registrarUrl(s) } };
    case "sendInvoice":
      return { title: t("guide.step.sendInvoice"), text: t("apps.guide.step.sendInvoice"), app: "Books" };
    case "loan":
      return { title: t("guide.step.loan"), text: t("apps.guide.step.loan"), app: "Browser", focus: { kind: "url", id: s.bank ? `${bankUrl(s.bank.id)}banking/loans` : HOME_URL } };
    case "tenCustomers":
      return { title: t("guide.step.tenCustomers"), text: t("apps.guide.step.tenCustomers"), app: "Support" };
    case "research":
      return { title: t("guide.step.research"), text: t("apps.guide.step.research"), app: "Research" };
    case "patch":
      return { title: t("guide.step.patch"), text: t("apps.guide.step.patch"), app: "Security" };
    case "hire":
      return { title: t("guide.step.hire"), text: t("apps.guide.step.hire"), app: "Staff" };
    case "study":
      return { title: t("guide.step.study"), text: t("apps.guide.step.study"), app: "Market" };
  }
}

// A card's own title and sentence; later-chapter cards are single goals and use the goal's text.
export function cardOf(s: GameState, c: Card): { title: string; text: string; step: Step } {
  const step = stepOf(s, nextGoal(s, c));
  // A card of several goals shows the sentence of the goal that is next.
  if (c.chapter === 1) return { title: t(`guide.card.${c.id}`), text: waiting(s, c.id) ? t(`guide.card.${c.id}.wait`) : c.goals.length > 1 ? step.text : t(`guide.card.${c.id}.text`), step };
  return { title: step.title, text: step.text, step };
}
