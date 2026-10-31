import { modelById } from "../../sim/10-catalog/hardware";
import { registrarById, REGISTRARS } from "../../sim/10-catalog/registrars";
import { supportApp } from "./support/desk";
import { t } from "../../i18n/en";
import { OFFICE_URL } from "../../sim/80-business/office";
import type { GameState } from "../../sim/50-state";
import type { TUTORIAL } from "../../sim/checklist";

export type StepId = (typeof TUTORIAL)[number];
export interface Step { title: string; text: string; app: string; focus?: { kind: string; id: string } }

// The Wikipedio article that explains a step.
export const STEP_WIKI: Partial<Record<StepId, string>> = {
  mountServer: "Rack_unit", internet: "Digital_subscriber_line", setup: "Server_installation",
  domain: "Domain_name", launch: "Web_hosting", email: "Email_blacklist",
};

const basement = (s: GameState) => s.locations.find((l) => l.space === "basement") ?? s.locations[0];
const firstServer = (s: GameState) => s.devices.find((d) => modelById(d.model).kind === "server");

// Where each tutorial step happens and what the Open button shows there.
export function stepOf(s: GameState, id: StepId): Step {
  const home = basement(s), server = firstServer(s);
  const mailApp = supportApp(s).name;
  switch (id) {
    case "register":
      return { title: t("guide.step.register"), text: t("apps.guide.step.register"), app: "Browser", focus: { kind: "url", id: OFFICE_URL } };
    case "company":
      return { title: t("guide.step.company"), text: t("apps.guide.step.company"), app: "Settings" };
    case "buyServer":
      return { title: t("guide.step.buyServer"), text: t("apps.guide.step.buyServer"), app: "Shop" };
    case "mountServer":
      return { title: t("guide.step.mountServer"), text: t("apps.guide.step.mountServer"), app: "Locations", focus: home && { kind: "location", id: home.id } };
    case "internet":
      return { title: t("guide.step.internet"), text: t("apps.guide.step.internet"), app: "Locations", focus: { kind: "line", id: "home" } };
    case "setup":
      return { title: t("guide.step.setup"), text: t("apps.guide.step.setup"), app: "Locations", focus: server && { kind: "device", id: server.id } };
    case "domain": {
      const partner = (s.registrar && registrarById(s.registrar.id)?.name) ?? REGISTRARS[0].name;
      return {
        title: t("guide.step.domain"),
        text: t("apps.guide.step.domain", { partner }),
        app: "Browser",
      };
    }
    case "website":
      return { title: t("guide.step.website"), text: t("apps.guide.step.website"), app: "Marketing", focus: { kind: "page", id: "channels" } };
    case "launch":
      return { title: t("guide.step.launch"), text: t("apps.guide.step.launch"), app: "Marketing", focus: { kind: "page", id: "channels" } };
    case "email":
      return { title: t("guide.step.email"), text: t("apps.guide.step.email", { app: mailApp }), app: "Support", focus: { kind: "mailSetup", id: "" } };
    case "firstCustomer":
      return { title: t("guide.step.firstCustomer"), text: t("apps.guide.step.firstCustomer", { app: mailApp }), app: "Support" };
  }
}
