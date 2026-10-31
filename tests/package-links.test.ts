import { describe, expect, it } from "vitest";
import { resolve } from "../src/sim/80-business/browser";
import { consoleFeatures, createFormFor, createLink, parseCreate } from "../src/sim/80-business/consoles";
import { yearOf } from "../src/sim/00-core/time";
import { panelVm, readyGame, skipTo } from "./fixtures";

function cpanic() {
  const s = readyGame(1);
  skipTo(s, 2010);
  s.cash = 1_000_000;
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic");
  return { s, id, c: s.clusters.find((x) => x.id === id)! };
}

describe("console addresses", () => {
  it("keeps the path and query of an address inside a console", () => {
    const { s, id } = cpanic();
    const link = createLink(s, id, "tkt12")!;
    expect(link).toMatch(/:2087\/scripts\/wwwacct\?order=tkt12$/);
    expect(resolve(s, link).page).toMatchObject({ kind: "console", clusterId: id, path: "/scripts/wwwacct?order=tkt12" });
    expect(parseCreate("cpanic", "/scripts/wwwacct?order=tkt12")).toEqual({ screen: "create", order: "tkt12" });
    expect(parseCreate("cpanic", "/scripts/wwwacct")).toEqual({ screen: "create" });
    expect(parseCreate("cpanic", "/scripts/addpkg")).toEqual({ screen: "packages" });
    expect(parseCreate("cpanic", "/")).toBeNull();
    expect(parseCreate("freepanel", "/scripts/wwwacct")).toBeNull();
  });

  it("builds a query link for a console whose address has a query", () => {
    expect(parseCreate("proxmocks", "/?create=vm&order=tkt3")).toEqual({ screen: "create", order: "tkt3" });
    expect(parseCreate("proxmocks", "/?create=ct")).toBeNull();
  });

  it("offers a create form only for the consoles that have one", () => {
    expect(createFormFor("cpanic", "webHosting")).toBe(true);
    expect(createFormFor("cpanic", "vps")).toBe(false);
    expect(createFormFor("pleskit", "webHosting")).toBe(true);
    expect(createFormFor("pleskit", "gameServer")).toBe(false);
    expect(createFormFor(null, "webHosting")).toBe(false);
  });

  it("returns no link for a cluster without a form or an unknown one", () => {
    const { s } = cpanic();
    expect(createLink(s, "nope", "tkt1")).toBeNull();
    expect(consoleFeatures("cpanic", yearOf(s.hour)).create).toBe(true);
  });
});
