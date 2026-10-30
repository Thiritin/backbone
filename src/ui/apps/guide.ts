import { modelById } from "../../sim/10-catalog/hardware";
import { registrarById, REGISTRARS } from "../../sim/10-catalog/registrars";
import { supportApp } from "./support/desk";
import { t } from "../../i18n/en";
import { OFFICE_URL } from "../../sim/80-business/office";
import type { GameState } from "../../sim/50-state";
import type { TUTORIAL } from "../../sim/checklist";

export type StepId = (typeof TUTORIAL)[number];
export interface Step { title: string; text: string; app: string; focus?: { kind: string; id: string } }

const basement = (s: GameState) => s.locations.find((l) => l.space === "basement") ?? s.locations[0];
const firstServer = (s: GameState) => s.devices.find((d) => modelById(d.model).kind === "server");

// Where each tutorial step happens and what the Open button shows there.
export function stepOf(s: GameState, id: StepId): Step {
  const home = basement(s), server = firstServer(s);
  const mailApp = supportApp(s).name;
  switch (id) {
    case "register":
      return { title: t("guide.step.register"), text: "Register your company at the trade office in the Browser.", app: "Browser", focus: { kind: "url", id: OFFICE_URL } };
    case "company":
      return { title: t("guide.step.company"), text: "Choose the name, logo and colour of your company.", app: "Settings" };
    case "buyServer":
      return { title: t("guide.step.buyServer"), text: "Buy your first server in the Shop.", app: "Shop" };
    case "mountServer":
      return { title: t("guide.step.mountServer"), text: "Mount it in a rack, cable it to the router and power it on in Locations.", app: "Locations", focus: home && { kind: "location", id: home.id } };
    case "internet":
      return { title: t("guide.step.internet"), text: "Order an internet line in Locations under Internet line.", app: "Locations", focus: { kind: "line", id: "home" } };
    case "setup":
      return { title: t("guide.step.setup"), text: "Download Debiant from its website, write the ISO to the USB stick in Finder, plug the stick into the server at the rack and boot from it. Install Debiant, then install a hypervisor or a web panel with the commands from its website.", app: "Locations", focus: server && { kind: "device", id: server.id } };
    case "domain": {
      const partner = (s.registrar && registrarById(s.registrar.id)?.name) ?? REGISTRARS[0].name;
      return {
        title: t("guide.step.domain"),
        text: `Buy a domain for your company at ${partner} in the Browser.`,
        app: "Browser",
      };
    }
    case "website":
      return { title: t("guide.step.website"), text: "Build your first website in Marketing under Channels.", app: "Marketing", focus: { kind: "page", id: "channels" } };
    case "launch":
      return { title: t("guide.step.launch"), text: "Choose where your website runs, launch it in Marketing and list your first product under Products.", app: "Marketing", focus: { kind: "page", id: "channels" } };
    case "email":
      return { title: t("guide.step.email"), text: `Choose an email provider in ${mailApp}.`, app: "Support", focus: { kind: "mailSetup", id: "" } };
    case "firstCustomer":
      return { title: t("guide.step.firstCustomer"), text: `Answer your first customer in ${mailApp}.`, app: "Support" };
  }
}
