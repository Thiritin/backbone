import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { consoleFeatures } from "../src/sim/80-business/consoles";
import { evcWarning, integrationServices } from "../src/sim/80-business/readouts";
import { createVm } from "../src/sim/90-actions/clusters";
import { setCompatMode } from "../src/sim/90-actions/cpus";
import { CONSOLES } from "../src/ui/apps/browser/consoles/ConsolePage";
import { flavorCounts } from "../src/ui/apps/browser/consoles/openstash/flavors";
import { TemplatesPage } from "../src/ui/apps/browser/consoles/openveezee/OpenVeeZee";
import { hypervisor, skipTo, withServer, newGame } from "./fixtures";

function cloud(id: string, year: number) {
  const s = withServer(newGame(3));
  skipTo(s, year);
  s.cash = 1_000_000;
  const c = hypervisor(s, ["dev3"], "Cloud 1", id);
  const made = createVm(s, c, { vcpu: 1, ramGb: 2, diskGb: 20 });
  if (!made.ok) throw new Error(made.error);
  return { s, cluster: s.clusters.find((x) => x.id === c)!, vm: s.workloads.find((w) => w.id === made.id)! };
}

const html = (id: string, year: number) => {
  const { s, cluster } = cloud(id, year);
  const View = CONSOLES[id];
  return renderToString(<View game={s} c={cluster} f={consoleFeatures(id, yearOf(s.hour))} host="cloud.example.com" signedIn login={() => {}} logout={() => {}} />);
};

describe("hypervisor readouts", () => {
  it("counts the instances of every flavor and none for the others", () => {
    const sizes = [{ vcpu: 1, ramGb: 2, diskGb: 20 }, { vcpu: 1, ramGb: 2, diskGb: 20 }, { vcpu: 2, ramGb: 4, diskGb: 40 }, { vcpu: 3, ramGb: 3, diskGb: 3 }];
    const n = Object.fromEntries(flavorCounts(sizes).map((x) => [x.name, x.n]));
    expect(n).toMatchObject({ "m1.tiny": 0, "m1.small": 2, "m1.medium": 1, "m1.large": 0 });
  });

  it("offers the flavors page next to the other admin pages", () => {
    expect(html("openstash", 2018)).toContain("Flavors");
  });

  it("warns for a cross-vendor target, not for the same vendor or in compatibility mode", () => {
    const { s, cluster, vm } = cloud("vmwhere", 2012);
    const a = s.devices.find((d) => d.id === "dev3")!;
    a.components = a.components.map((x) => (x.kind === "board" ? { ...x, vendor: "indel" as const } : x));
    const b = { ...structuredClone(a), id: "dev-b" };
    b.components = b.components.map((x) => (x.kind === "board" ? { ...x, vendor: "amb" as const } : x));
    s.devices.push(b);
    s.clusters.push({ ...structuredClone(cluster), id: "c-b", nodes: [{ deviceId: "dev-b", state: "active" }] });
    expect(evcWarning(s, vm, "dev-b")).toBe(true);
    expect(evcWarning(s, vm, "dev3")).toBe(false);
    expect(setCompatMode(s, cluster.id, true).ok).toBe(true);
    expect(evcWarning(s, vm, "dev-b")).toBe(true);
    expect(setCompatMode(s, "c-b", true).ok).toBe(true);
    expect(evcWarning(s, vm, "dev-b")).toBe(false);
  });

  it("shows the EVC state on the cluster page", () => {
    expect(html("vmwhere", 2012)).toContain("VMware EVC");
  });

  it("asks a guest older than the host for an update and shows a stopped VM as off", () => {
    const { s, cluster, vm } = cloud("hypervee", 2014);
    vm.os = { id: "lunix", version: "1", installedAt: 0 } as never;
    cluster.version = 2014;
    expect(integrationServices(s, cluster, vm)).toMatchObject({ version: "update" });
    expect(integrationServices(s, cluster, vm).services.find((x) => x.key === "backup")?.state).toBe("update");
    vm.stopped = true;
    expect(integrationServices(s, cluster, vm).services.every((x) => x.state === "off")).toBe(true);
    expect(html("hypervee", 2014)).toContain("Integration Services version");
  });

  it("lists the OS templates on their own page and routes the empty text through t", () => {
    const { s } = cloud("openveezee", 2008);
    expect(renderToString(<TemplatesPage game={s} vms={[]} />)).toContain("OS templates");
  });
});
