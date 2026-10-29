import { modelById } from "../../sim/10-catalog/hardware";
import { registrarById } from "../../sim/10-catalog/registrars";
import { deskOf } from "../../sim/10-catalog/desks";
import type { GameState } from "../../sim/50-state";
import { adminUrl } from "../../sim/80-business/browser";
import type { TUTORIAL } from "../../sim/checklist";

export type StepId = (typeof TUTORIAL)[number];
export interface Step { title: string; text: string; app: string; focus?: { kind: string; id: string } }

const basement = (s: GameState) => s.locations.find((l) => l.space === "basement") ?? s.locations[0];
const firstServer = (s: GameState) => s.devices.find((d) => modelById(d.model).kind === "server");

// Where each tutorial step happens and what the Open button shows there.
export function stepOf(s: GameState, id: StepId): Step {
  const home = basement(s), server = firstServer(s);
  const mailApp = deskOf(s) ? "Support" : "Email";
  switch (id) {
    case "company":
      return { title: "Name your company", text: "Choose the name, logo and colour of your company.", app: "Settings" };
    case "networkApp":
      return { title: "Install the Network app", text: "Install the Network app from the Pear Store, where you order and manage your domains.", app: "Shop", focus: { kind: "software", id: "" } };
    case "buyServer":
      return { title: "Buy a server", text: "Buy your first server in the Shop.", app: "Shop" };
    case "mountServer":
      return { title: "Mount and power it", text: "Mount it in a rack, cable it to the router and power it on in Locations.", app: "Locations", focus: home && { kind: "location", id: home.id } };
    case "internet":
      return { title: "Add internet", text: "Order an internet line in Locations under Internet line.", app: "Locations", focus: { kind: "line", id: "home" } };
    case "setup":
      return { title: "Install software", text: "Install a hypervisor or a web panel from the server's Add Software tile.", app: "Locations", focus: server && { kind: "device", id: server.id } };
    case "domain": {
      const partner = s.registrar && registrarById(s.registrar.id)?.name;
      return {
        title: "Register your domain",
        text: partner ? `Register your company domain with ${partner} in Network under Domains.` : "Sign a registrar contract and register your company domain in Network under Domains.",
        app: "Network", focus: { kind: "page", id: "domains" },
      };
    }
    case "website":
      return { title: "Build your website", text: "Build your website and list your first product from the Admin page in the Browser.", app: "Browser", focus: { kind: "url", id: adminUrl(s) } };
    case "email":
      return { title: "Set up company email", text: "Choose an email provider in the Email app.", app: "Support", focus: { kind: "mailSetup", id: "" } };
    case "firstCustomer":
      return { title: "Win your first customer", text: `Answer your first customer in ${mailApp}.`, app: "Support" };
  }
}
