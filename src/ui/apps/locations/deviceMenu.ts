import { euro } from "../../../sim/00-core/money";
import { dualPsuModel, modelById, priceOf } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { clusterOf, workloadsOn } from "../../../sim/60-infra/cluster";
import { pduOf } from "../../../sim/60-infra/pdu";
import { isPlugged, locationOf } from "../../../sim/60-infra/status";
import { joinableClusters } from "../../../sim/90-actions/software";
import { addNode, cordon, drain, removeNode, uncordon } from "../../../sim/90-actions/clusters";
import { addSecondPsu, buyOutLease } from "../../../sim/90-actions/hardware";
import type { MenuEntry } from "../../desktop/menu";
import { useStore } from "../../store";
import { techItem } from "./TechButton";
import { frontOptions, powerOptions, type PowerOp } from "./power";
import type { FrontOp } from "../../../sim/60-infra/power";

// What the menu hands back to its view: steps that need a sheet, a field or the offline check.
export interface DeviceUi {
  open?: () => void;
  lid?: () => void;
  power: (on: boolean) => void;
  op: (op: PowerOp) => void;
  front: (op: FrontOp) => void;
  plug: (psuId: string) => void;
  setup: () => void;
  maintain?: () => void;
  rename: () => void;
  unmount: () => void;
  sell: () => void;
}

export const secondPsuPrice = (d: Device): number | null => {
  const to = dualPsuModel(d.model);
  return to ? priceOf(to, d.brand) - priceOf(modelById(d.model), d.brand) : null;
};

const psuEntries = (d: Device, ui: DeviceUi): MenuEntry[] => {
  const psus = d.rackId ? d.components.filter((c) => c.kind === "psu") : [];
  return psus.map((c, i) => ({ label: `${isPlugged(c) ? "Unplug" : "Plug in"} ${psus.length > 1 ? `power supply ${i + 1}` : "power supply"}`, run: () => ui.plug(c.id) }));
};

// A mounted server's power entries: from afar, then at the machine (remote hands in a datacenter), then what a technician can do.
function serverPower(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const { via, options } = powerOptions(game, d);
  const psus = d.components.filter((c) => c.kind === "psu").length;
  return [
    ...options.map((o) => ({ label: via && o.op !== "bmc" ? `${o.label} via ${via}` : o.label, disabled: o.disabled, run: () => ui.op(o.op) })),
    { label: locationOf(game, d)?.dc ? "Remote hands" : "At the server", items: [
      ...frontOptions(game, d).map((o) => ({ label: o.label, disabled: o.disabled, run: () => ui.front(o.op) })),
      ...(psus > 1 ? [null, ...psuEntries(d, ui)] : []),
    ] },
    techItem(game, d.id, d.on ? "off" : "on"),
    d.hung && techItem(game, d.id, "reset"),
    d.bmcHung && !d.hands && techItem(game, d.id, "bmcreset"),
  ];
}

// A rack device's actions, in the order of a Pear context menu: open, power, role, upgrades, then removal.
export function deviceMenu(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const m = modelById(d.model), server = m.kind === "server";
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
    ...(server ? [] : psuEntries(d, ui)),
    null,
    server && !!d.rackId && { label: "Add Software…", run: ui.setup },
    server && !!d.rackId && ui.maintain && { label: "Plan maintenance…", run: ui.maintain },
    joinable.length > 0 && { label: "Join cluster", items: joinable.map((c) => ({ label: c.name, run: () => act(addNode, c.id, d.id) })) },
    node && (node.state === "active" ? { label: "Cordon", run: () => act(cordon, d.id) } : node.state === "cordoned" && { label: "Uncordon", run: () => act(uncordon, d.id) }),
    node && !busy && { label: "Drain", run: () => act(drain, d.id) },
    node && !busy && techItem(game, d.id, "drain"),
    cluster && { label: `Open ${cluster.name}`, run: () => openApp("Products", { kind: "cluster", id: cluster.id }) },
    node && cluster && cluster.nodes.length > 1 && !loads.length && { label: "Remove from cluster", run: () => act(removeNode, d.id) },
    null,
    psuPrice !== null && { label: `Add second power supply, ${euro(psuPrice)}`, run: () => act(addSecondPsu, d.id) },
    lease && { label: `Buy out lease, ${euro(lease.monthly * (lease.months - lease.paid))}`, run: () => act(buyOutLease, lease.id) },
    { label: "Rename…", run: ui.rename },
    null,
    !!d.rackId && { label: "Unmount", run: ui.unmount },
    m.kind !== "gateway" && { label: "Sell…", run: ui.sell },
  ];
}
