import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame } from "../src/sim/50-state";
import { bookingFor, covers, defaultSpecFor, missingOn, packageNamed, packagesOf, type PackageDef } from "../src/sim/80-business/packages";
import { addCustomer } from "../src/sim/90-actions/customers";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addPackage, copyPackages, deletePackage, editPackage } from "../src/sim/90-actions/packages";
import { runAction } from "../src/sim/90-actions";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer } from "./fixtures";

const setup = () => {
  const s = withServer(newGame(1)), id = panelServer(s, "dev3");
  const def = (name: string, k = 1): PackageDef => ({ name, product: "webHosting", spec: { ...defaultSpecFor("webHosting", yearOf(s.hour)), vcpu: k } });
  return { s, id, def };
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);

describe("package store", () => {
  it("adds, edits and finds a package case-insensitively", () => {
    const { s, id, def } = setup();
    expect(addPackage(s, id, def("Basic"))).toEqual({ ok: true, id: "Basic" });
    expect(packageNamed(s.clusters[0], "basic")?.name).toBe("Basic");
    const spec = { ...def("x").spec, ramGb: 4 };
    expect(editPackage(s, id, "BASIC", spec).ok).toBe(true);
    expect(packagesOf(s.clusters[0])[0].spec.ramGb).toBe(4);
    expect(err(editPackage(s, id, "nope", spec))).toBe("error.packageMissing");
  });

  it("refuses duplicates, bad names, bad specs and a wrong product", () => {
    const { s, id, def } = setup();
    addPackage(s, id, def("Basic"));
    expect(err(addPackage(s, id, def("basic")))).toBe("error.packageTaken");
    expect(err(addPackage(s, id, def("bad/name")))).toBe("error.packageName");
    expect(err(addPackage(s, id, def("x".repeat(25))))).toBe("error.packageName");
    expect(err(addPackage(s, id, def("Zero", 0)))).toBe("error.packageSpec");
    expect(err(addPackage(s, id, { ...def("Game"), product: "gameServer" }))).toBe("error.packageProduct");
    expect(err(addPackage(s, "nope", def("A")))).toBe("error.unknownCluster");
  });

  it("holds at most 12 packages", () => {
    const { s, id, def } = setup();
    for (let i = 0; i < 12; i++) expect(addPackage(s, id, def(`P${i}`)).ok).toBe(true);
    expect(err(addPackage(s, id, def("P12")))).toBe("error.packageLimit");
  });

  it("will not delete a package an active service uses", () => {
    const { s, id, def } = setup();
    addPackage(s, id, def("Basic"));
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const sv = provisionService(s, cus, "webHosting", { label: "a", clusterId: id });
    if (!sv.ok) throw new Error(sv.error);
    s.services.find((v) => v.id === sv.id)!.pkg = "basic";
    expect(err(deletePackage(s, id, "Basic"))).toBe("error.packageInUse");
    s.services.find((v) => v.id === sv.id)!.pkg = undefined;
    expect(deletePackage(s, id, "Basic").ok).toBe(true);
    expect(packagesOf(s.clusters[0])).toEqual([]);
  });

  it("copies only the packages the target lacks", () => {
    const { s, id, def } = setup();
    s.clusters.push({ ...structuredClone(s.clusters[0]), id: "cl-b", packages: [def("Basic", 2)] });
    addPackage(s, id, def("Basic")); addPackage(s, id, def("Plus"));
    expect(copyPackages(s, id, "cl-b")).toEqual({ ok: true, id: "1" });
    const b = s.clusters.find((c) => c.id === "cl-b")!;
    expect(packagesOf(b).map((p) => p.name)).toEqual(["Basic", "Plus"]);
    expect(packageNamed(b, "Basic")!.spec.vcpu).toBe(2);
    expect(missingOn(s, [id, "cl-b"], "Plus")).toEqual([]);
    expect(missingOn(s, [id, "cl-b"], "Zed")).toEqual([id, "cl-b"]);
  });

  it("books the package size and flags a smaller one as oversold", () => {
    const { s, def } = setup();
    const sold = sizeSpec("webHosting", 1, yearOf(s.hour));
    const big = { ...def("B"), spec: { ...sold, vcpu: sold.vcpu * 2 } };
    expect(covers(big, sold)).toBe(true);
    expect(bookingFor(big, sold).book.vcpu).toBe(sold.vcpu * 2);
    expect(bookingFor(big, sold).promised).toBeUndefined();
    const small = { ...def("S"), spec: { ...sold, ramGb: sold.ramGb / 2 } };
    expect(bookingFor(small, sold).promised?.ramGb).toBe(sold.ramGb);
  });

  it("is a registered action and keeps packages through a save; an old save loads with none", () => {
    const { s, id, def } = setup();
    expect(runAction(s, "addPackage", [id, def("Basic")]).ok).toBe(true);
    expect(packagesOf(deserialize(serialize(s)).clusters[0]).map((p) => p.name)).toEqual(["Basic"]);
    const old = JSON.parse(serialize(s)) as { clusters?: Record<string, unknown>[]; state?: { clusters: Record<string, unknown>[] } };
    for (const c of (old.state ?? old).clusters!) delete c.packages;
    expect(packagesOf(deserialize(JSON.stringify(old)).clusters[0])).toEqual([]);
  });
});
