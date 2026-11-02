import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import type { App } from "../src/sim/10-catalog/apps";
import type { GameState } from "../src/sim/50-state";
import { companyDomain } from "../src/sim/30-customers/domains";
import { resolve } from "../src/sim/80-business/browser";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { webspaceOf } from "../src/sim/60-infra/webspace";
import { createAddonDomain } from "../src/sim/90-actions/webspace";
import { BASEMENT_SERVER, newGame, panelServer, skipTo, withServer } from "./fixtures";

// A customer on a cPanic server with the given app, sold and read in the given year.
function account(app: App, year = 2010, panel = "cpanic") {
  const s = withServer(newGame(3));
  skipTo(s, year);
  const host = panelServer(s, BASEMENT_SERVER, panel);
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const r = provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, year), mailboxes: 2, app }, clusterId: host });
  if (!r.ok) throw new Error(r.error);
  s.hour += 60 * 24;
  const v = s.services.find((x) => x.id === r.id)!;
  v.domain = "sockenshop.de";
  return { s, id: s.workloads.find((x) => x.serviceId === v.id)!.id, v };
}
const body = (s: GameState, host: string) => {
  const p = resolve(s, host).page;
  return p.kind === "webspace" ? p.body : p;
};
const overlay = (s: GameState, id: string, o: NonNullable<GameState["webspaces"][string]>) => { s.webspaces[id] = o; };

describe("sites on web spaces", () => {
  it("shows an installed app with its theme", () => {
    for (const app of ["wordpass", "joomlah", "drupel"] as const) {
      const { s } = account(app);
      expect(body(s, "sockenshop.de")).toMatchObject({ kind: "app", app, title: "Socken Shop" });
      expect(body(s, "www.sockenshop.de")).toMatchObject({ kind: "app", app });
    }
  });

  it("leaves a static site to the customer's designed page", () => {
    const { s, v } = account("static");
    expect(resolve(s, "sockenshop.de").page).toEqual({ kind: "customer", serviceId: v.id });
  });

  it("reports a missing database and a missing config file as the app's errors", () => {
    const { s, id } = account("wordpass");
    const db = webspaceOf(s, id)!.app!.db;
    overlay(s, id, { databases: { [db]: false } });
    expect(body(s, "sockenshop.de")).toMatchObject({ kind: "error", error: "db", app: "wordpass", detail: db });
    overlay(s, id, { files: { "public_html/wp-config.php": false } });
    expect(body(s, "sockenshop.de")).toMatchObject({ kind: "error", error: "fatal", detail: expect.stringContaining("wp-config.php") });
  });

  it("shows a 500 page over the disk quota", () => {
    const { s, id } = account("joomlah");
    overlay(s, id, { files: { "public_html/media": { dir: true, mb: 5000, at: 0 } } });
    expect(body(s, "sockenshop.de")).toMatchObject({ kind: "error", error: "http500" });
  });

  it("shows the panel's account suspended page for a held service", () => {
    const { s, v } = account("wordpass");
    s.heldServices[v.id] = "payment";
    const r = resolve(s, "sockenshop.de");
    expect(r.load).toBe("fast");
    expect(r.page).toMatchObject({ kind: "webspace", body: { kind: "error", error: "suspended" } });
  });

  it("lists a folder with files and no index, and shows the placeholder for an empty one", () => {
    const { s, id } = account("wordpass");
    overlay(s, id, { files: { "public_html/index.php": false } });
    const listing = body(s, "sockenshop.de");
    expect(listing).toMatchObject({ kind: "index", panel: "cpanic", listing: expect.arrayContaining([expect.objectContaining({ name: "wp-admin", dir: true })]) });
    expect(JSON.stringify(listing)).not.toContain(".htaccess");
    expect(createAddonDomain(s, id, "socken-extra.de", "public_html/extra").ok).toBe(true);
    expect(body(s, "socken-extra.de")).toMatchObject({ kind: "index", listing: null });
  });

  it("answers for every panel with its own placeholder", () => {
    for (const panel of ["cpanic", "pleskit", "directadmen", "freepanel"]) {
      const { s, id } = account("wordpass", 2010, panel);
      expect(createAddonDomain(s, id, "leer.de", `${webspaceOf(s, id)!.webroot}/leer`).ok).toBe(true);
      expect(body(s, "leer.de")).toMatchObject({ kind: "index", panel, listing: null });
    }
  });

  it("shows the panel's default page at the shop address until the shop is installed", () => {
    const s = withServer(newGame(3));
    skipTo(s, 2010);
    panelServer(s, BASEMENT_SERVER, "cpanic");
    s.company.domain = "hostco.de";
    expect(companyDomain(s)).toBe("hostco.de");
    expect(body(s, "portal.hostco.de")).toMatchObject({ kind: "index", panel: "cpanic", listing: null });
  });

  it("is the same for the same game", () => {
    expect(body(account("drupel").s, "sockenshop.de")).toEqual(body(account("drupel").s, "sockenshop.de"));
  });
});
