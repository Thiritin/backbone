import { euro } from "../../../sim/00-core/money";
import { dualPsuModel, modelById, priceOf } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { clusterOf, workloadsOn } from "../../../sim/60-infra/cluster";
import { pduOf } from "../../../sim/60-infra/pdu";
import { isPlugged } from "../../../sim/60-infra/status";
import { joinableClusters } from "../../../sim/90-actions/software";
import { addNode, cordon, drain, removeNode, uncordon } from "../../../sim/90-actions/clusters";
import { addSecondPsu, buyOutLease } from "../../../sim/90-actions/hardware";
import type { MenuEntry } from "../../desktop/menu";
import { useStore } from "../../store";
import { techItem } from "./TechButton";
import { powerOptions, type PowerOp } from "./power";

// What the menu hands back to its view: steps that need a sheet, a field or the offline check.
export interface DeviceUi {
  open?: () => void;
  lid?: () => void;
  power: (on: boolean) => void;
  op: (op: PowerOp) => void;
  plug: (psuId: string) => void;
  setup: () => void;
  rename: () => void;
  unmount: () => void;
  sell: () => void;
}

export const secondPsuPrice = (d: Device): number | null => {
  const to = dualPsuModel(d.model);
  return to ? priceOf(to, d.brand) - priceOf(modelById(d.model), d.brand) : null;
};

// A mounted server's power entries: through its management controller when it answers, on site otherwise, then what a technician can do.
function serverPower(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const { via, options } = powerOptions(game, d);
  return [
    ...options.map((o) => ({ label: via && o.op !== "pull" ? `${o.label} via ${via}` : o.label, disabled: o.disabled, run: () => ui.op(o.op) })),
    techItem(game, d.id, d.on ? "off" : "on"),
    d.hung && techItem(game, d.id, "reset"),
    d.bmcHung && !d.hands && techItem(game, d.id, "bmcreset"),
  ];
}

// A rack device's actions, in the order of a Pear context menu: open, power, role, upgrades, then removal.
export function deviceMenu(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const m = modelById(d.model), server = m.kind === "server";
  const psus = d.rackId ? d.components.filter((c) => c.kind === "psu") : [];
  const cluster = server ? clusterOf(game, d.id) : undefined, node = cluster?.nodes.find((n) => n.deviceId === d.id);
  const loads = server ? workloadsOn(game, d.id) : [];
  const joinable = server ? joinableClusters(game, d.id) : [];
  const lease = d.lease ? game.leases.find((l) => l.id === d.lease) : undefined;
  const psuPrice = d.rackId ? secondPsuPrice(d) : null;
  const busy = node && (node.state === "draining" || node.state === "maintenance");
  return [
    ui.open && { label: "Show details", run: ui.open },
    null,
    ...(server && d.rackId ? serverPower(game, d, ui) : [
      m.kind !== "patch" && { label: d.on ? "Power off" : "Power on", disabled: !d.rackId && !d.panel, run: () => ui.power(!d.on) },
      m.kind !== "patch" && d.on && !!pduOf(game, d) && { label: "Power cycle", run: () => ui.op("cycle") },
      m.kind !== "patch" && !!(d.rackId || d.panel) && techItem(game, d.id, d.on ? "off" : "on"),
    ]),
    server && !!(d.rackId || d.store) && ui.lid && { label: "Change parts", disabled: d.on, run: ui.lid },
    ...psus.map((c, i) => ({ label: `${isPlugged(c) ? "Unplug" : "Plug in"} ${psus.length > 1 ? `power supply ${i + 1}` : "power supply"}`, run: () => ui.plug(c.id) })),
    null,
    server && !!d.rackId && { label: "Add Software…", run: ui.setup },
    joinable.length > 0 && { label: "Join cluster", items: joinable.map((c) => ({ label: c.name, run: () => act((g) => addNode(g, c.id, d.id)) })) },
    node && (node.state === "active" ? { label: "Cordon", run: () => act((g) => cordon(g, d.id)) } : node.state === "cordoned" && { label: "Uncordon", run: () => act((g) => uncordon(g, d.id)) }),
    node && !busy && { label: "Drain", run: () => act((g) => drain(g, d.id)) },
    node && !busy && techItem(game, d.id, "drain"),
    cluster && { label: `Open ${cluster.name}`, run: () => openApp("Products", { kind: "cluster", id: cluster.id }) },
    node && cluster && cluster.nodes.length > 1 && !loads.length && { label: "Remove from cluster", run: () => act((g) => removeNode(g, d.id)) },
    null,
    psuPrice !== null && { label: `Add second power supply, ${euro(psuPrice)}`, run: () => act((g) => addSecondPsu(g, d.id)) },
    lease && { label: `Buy out lease, ${euro(lease.monthly * (lease.months - lease.paid))}`, run: () => act((g) => buyOutLease(g, lease.id)) },
    { label: "Rename…", run: ui.rename },
    null,
    !!d.rackId && { label: "Unmount", run: ui.unmount },
    m.kind !== "gateway" && { label: "Sell…", run: ui.sell },
  ];
}
