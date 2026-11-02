import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import { installingOn, moduleBills, serviceName, stackOf } from "../src/sim/60-infra/panel-services";
import { tick, tickMinute } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { installComponent, removeModule, restartService } from "../src/sim/90-actions/panel-ops";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const cluster = (s: GameState, id: string) => s.clusters.find((c) => c.id === id)!;
const minutes = (s: GameState, n: number) => { for (let i = 0; i < n; i++) tickMinute(s); };

function host(year: number, family = "cpanic", seed = 4) {
  const s = withServer(newGame(seed));
  s.hour = hourOf(new Date(Date.UTC(year, 0, 1)));
  const id = panelServer(s, "dev3", family);
  const site = ok(provisionService(s, addCustomer(s, "Customer", "hobbyDev"), "webHosting", { label: "site.de", spec: sizeSpec("webHosting", 0, 2005), clusterId: id }));
  return { s, id, site };
}

describe("panel services", () => {
  it("takes the sites down while the web server restarts and clears what an update broke", () => {
    const { s, id, site } = host(2012);
    s.webpanel = { ...s.webpanel, appBroken: { [site]: s.hour + 48 }, phpBroken: { [site]: "5.2" } };
    expect(serviceOnline(s, site)).toBe(true);
    ok(restartService(s, id, "httpd"));
    expect(restartService(s, id, "httpd")).toEqual({ ok: false, error: "error.restarting" });
    expect(s.webpanel.appBroken[site]).toBeUndefined();
    expect(s.webpanel.phpBroken[site]).toBeUndefined();
    expect(serviceOnline(s, site)).toBe(false);
    minutes(s, 2);
    expect(serviceOnline(s, site)).toBe(true);
    expect(s.webpanel.restarts).toEqual({});
    ok(restartService(s, id, "httpd"));
  });

  it("keeps the sites up while a mail service restarts and names slot services after the component", () => {
    const { s, id, site } = host(2012);
    ok(restartService(s, id, "exim"));
    expect(serviceOnline(s, site)).toBe(true);
    expect(serviceName(s, cluster(s, id), "exim")).toBe("Exhim");
    expect(serviceName(s, cluster(s, id), "sshd")).toBe("sshd");
    expect(restartService(s, id, "nginx")).toEqual({ ok: false, error: "error.unknownService" });
  });
});

describe("panel components", () => {
  it("swaps the web server after the install time, one install at a time", () => {
    const { s, id } = host(2018);
    ok(installComponent(s, id, "enginexApatchy"));
    expect(installComponent(s, id, "proFtpeed")).toEqual({ ok: false, error: "error.installing" });
    expect(installingOn(s, id)?.id).toBe("enginexApatchy");
    minutes(s, 29);
    expect(stackOf(s, cluster(s, id)).web).toBe("apatchy");
    minutes(s, 1);
    expect(stackOf(s, cluster(s, id)).web).toBe("enginexApatchy");
    expect(s.webpanel.installing).toEqual({});
    expect(serviceName(s, cluster(s, id), "httpd")).toBe("Enginex + Apatchy");
    expect(installComponent(s, id, "enginexApatchy")).toEqual({ ok: false, error: "error.componentInstalled" });
  });

  it("offers a component only to its panels from its first year", () => {
    const early = host(2016);
    expect(installComponent(early.s, early.id, "enginexApatchy")).toEqual({ ok: false, error: "error.componentUnavailable" });
    const { s, id } = host(2018);
    expect(installComponent(s, id, "liteSpeedo")).toEqual({ ok: false, error: "error.componentUnavailable" });
    const da = host(2010, "directadmen");
    ok(installComponent(da.s, da.id, "liteSpeedo"));
  });

  it("books the fee of an installed module each month until it is removed", () => {
    const { s, id } = host(2018);
    ok(installComponent(s, id, "wordpassToolkit"));
    minutes(s, 15);
    expect(stackOf(s, cluster(s, id)).modules).toEqual(["wordpassToolkit"]);
    s.hour = hourOf(new Date(Date.UTC(2018, 1, 1))) - 1;
    tick(s);
    const line = s.ledger.find((e) => e.key === "ledger.panelModule");
    expect(line).toMatchObject({ amount: -8, params: { module: "WordPass Toolkit", host: cluster(s, id).name } });
    ok(removeModule(s, id, "wordpassToolkit"));
    expect(removeModule(s, id, "wordpassToolkit")).toEqual({ ok: false, error: "error.notInstalled" });
    expect(moduleBills(s)).toEqual([]);
  });

  it("loads a save from before services and components", () => {
    const { s, id } = host(2018);
    ok(installComponent(s, id, "wordpassToolkit"));
    const raw = JSON.parse(serialize(s)) as { webpanel: Record<string, unknown> };
    expect(deserialize(JSON.stringify(raw)).webpanel.installing[id].id).toBe("wordpassToolkit");
    delete raw.webpanel.restarts; delete raw.webpanel.components; delete raw.webpanel.installing;
    const old = deserialize(JSON.stringify(raw));
    expect([old.webpanel.restarts, old.webpanel.components, old.webpanel.installing]).toEqual([{}, {}, {}]);
    expect(stackOf(old, cluster(old, id))).toEqual({ mail: "exhim", ftp: "pureeFtpd", web: "apatchy", modules: [] });
  });
});
