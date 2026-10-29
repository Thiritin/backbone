import { euro } from "../../../sim/00-core/money";
import { dualPsuModel, modelById, priceOf } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { clusterOf, serverTaken, workloadsOn } from "../../../sim/60-infra/cluster";
import { isPlugged, locationOf } from "../../../sim/60-infra/status";
import { addNode, cordon, drain, removeNode, uncordon } from "../../../sim/90-actions/clusters";
import { addSecondPsu, buyOutLease } from "../../../sim/90-actions/hardware";
import type { MenuEntry } from "../../desktop/menu";
import { useStore } from "../../store";
import { techItem } from "./TechButton";

// What the menu hands back to its view: steps that need a sheet, a field or the offline check.
export interface DeviceUi {
  open?: () => void;
  power: (on: boolean) => void;
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

// A rack device's actions, in the order of a Pear context menu: open, power, role, upgrades, then removal.
export function deviceMenu(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const m = modelById(d.model), server = m.kind === "server";
  const psus = d.rackId ? d.components.filter((c) => c.kind === "psu") : [];
  const cluster = server ? clusterOf(game, d.id) : undefined, node = cluster?.nodes.find((n) => n.deviceId === d.id);
  const loads = server ? workloadsOn(game, d.id) : [];
  const az = locationOf(game, d)?.az;
  const joinable = server && !cluster && !serverTaken(game, d.id) && d.rackId ? game.clusters.filter((c) => c.az === az && c.kind === "cloud") : [];
  const lease = d.lease ? game.leases.find((l) => l.id === d.lease) : undefined;
  const psuPrice = d.rackId ? secondPsuPrice(d) : null;
  const busy = node && (node.state === "draining" || node.state === "maintenance");
  return [
    ui.open && { label: "Show details", run: ui.open },
    null,
    m.kind !== "patch" && { label: d.on ? "Power off" : "Power on", disabled: !d.rackId && !d.panel, run: () => ui.power(!d.on) },
    m.kind !== "patch" && !!(d.rackId || d.panel) && techItem(game, d.id, d.on ? "off" : "on"),
    ...psus.map((c, i) => ({ label: `${isPlugged(c) ? "Unplug" : "Plug in"} ${psus.length > 1 ? `power supply ${i + 1}` : "power supply"}`, run: () => ui.plug(c.id) })),
    null,
    server && !cluster && !loads.length && !!d.rackId && { label: "Set up control plane…", run: ui.setup },
    joinable.length > 0 && { label: "Add to cluster", items: joinable.map((c) => ({ label: c.name, run: () => act((g) => addNode(g, c.id, d.id)) })) },
    node && (node.state === "active" ? { label: "Cordon", run: () => act((g) => cordon(g, d.id)) } : node.state === "cordoned" && { label: "Uncordon", run: () => act((g) => uncordon(g, d.id)) }),
    node && !busy && { label: "Drain", run: () => act((g) => drain(g, d.id)) },
    node && !busy && techItem(game, d.id, "drain"),
    cluster?.controlPlane === d.id && { label: cluster.panel || cluster.platform ? "Change control plane" : "Install control plane", run: () => openApp("Products", { kind: "cluster", id: cluster.id }) },
    node && cluster?.kind === "cloud" && !loads.length && { label: "Remove from cluster", run: () => act((g) => removeNode(g, d.id)) },
    null,
    psuPrice !== null && { label: `Add second power supply, ${euro(psuPrice)}`, run: () => act((g) => addSecondPsu(g, d.id)) },
    lease && { label: `Buy out lease, ${euro(lease.monthly * (lease.months - lease.paid))}`, run: () => act((g) => buyOutLease(g, lease.id)) },
    { label: "Rename…", run: ui.rename },
    null,
    !!d.rackId && { label: "Unmount", run: ui.unmount },
    m.kind !== "gateway" && { label: "Sell…", run: ui.sell },
  ];
}
