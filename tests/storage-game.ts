import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { installSoftware } from "../src/sim/90-actions/software";
import { bootedMachine, skipTo, withServer, newGame } from "./fixtures";

void serviceOnline;

// A game in 2018 whose basement server runs the given storage software, with one storage customer on it.
export function storageGame(software: string) {
  const s = withServer(newGame(2));
  skipTo(s, 2018);
  installSoftware(s, bootedMachine(s, "dev3"), software);
  s.clusters = s.clusters.map((c) => (c.kind === "storage" ? { ...c, panel: software, switching: null } : c));
  s.devices = s.devices.map((d) => ({ ...d, software: d.software.map((sw) => ({ ...sw, doneAt: sw.doneAt !== null ? Math.min(sw.doneAt, s.hour) : null })) }));
  const cluster = s.clusters.find((c) => c.kind === "storage")!, cust = addCustomer(s, "Anna Albers", "private");
  const r = provisionService(s, cust, "storage", { label: "anna", spec: sizeSpec("storage", 0, 2018), clusterId: cluster.id });
  if (!r.ok) throw new Error(r.error);
  const v = () => s.services.find((x) => x.product === "storage")!;
  return { s, cluster, cust, v, happy: () => s.customers.find((c) => c.id === v().customerId)!.happiness, customer: () => s.customers.find((c) => c.id === v().customerId)! };
}

