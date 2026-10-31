import { euro } from "../../../sim/00-core/money";
import { dualPsuModel, modelById, priceOf } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { clusterOf, workloadsOn } from "../../../sim/60-infra/cluster";
import { pduOf } from "../../../sim/60-infra/pdu";
import { freeSlots, isPlugged, locationOf, travelCost } from "../../../sim/60-infra/status";
import { startBurnin } from "../../../sim/90-actions/burnin";
import { burning } from "../../../sim/60-infra/status";
import { removeNode } from "../../../sim/90-actions/clusters";
import { addSecondPsu, buyOutLease } from "../../../sim/90-actions/hardware";
import type { MenuEntry } from "../../desktop/menu";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { consoleEntry } from "../products/parts";
import { techItem } from "./TechButton";
import { frontOptions, handsLabel, powerOptions, type PowerOp } from "./power";
import type { FrontOp } from "../../../sim/60-infra/power";

// What the menu hands back to its view: steps that need a sheet, a field or the offline check.
export interface DeviceUi {
  open?: () => void;
  lid?: () => void;
  power: (on: boolean) => void;
  op: (op: PowerOp) => void;
  front: (op: FrontOp) => void;
  plug: (psuId: string) => void;
  maintain?: () => void;
  move?: (locationId: string) => void;
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
  return psus.map((c, i) => ({ label: t(isPlugged(c) ? "locations-1.unplugPsu" : "locations-1.plugPsu", { n: psus.length > 1 ? i + 1 : 0 }), run: () => ui.plug(c.id) }));
};

// A mounted server's power entries: from afar, then at the machine (remote hands in a datacenter), then what a technician can do.
function serverPower(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const { via, options } = powerOptions(game, d);
  const psus = d.components.filter((c) => c.kind === "psu").length;
  return [
    ...options.map((o) => ({ label: via && o.op !== "bmc" ? t("locations-1.viaLabel", { label: o.label, via }) : o.label, disabled: o.disabled, run: () => ui.op(o.op) })),
    { label: handsLabel(game, d), items: [
      ...frontOptions(game, d).map((o) => ({ label: o.label, disabled: o.disabled, run: () => ui.front(o.op) })),
      ...(psus > 1 ? [null, ...psuEntries(d, ui)] : []),
    ] },
    techItem(game, d.id, d.on ? "off" : "on"),
    d.hung && techItem(game, d.id, "reset"),
    d.bmcHung && !d.hands && techItem(game, d.id, "bmcreset"),
  ];
}

// The other locations that have a rack with room for the server, each with what the shipping costs.
function moveEntries(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const here = locationOf(game, d)?.id, height = modelById(d.model).height;
  const targets = game.locations.filter((l) => l.id !== here && l.readyAt <= game.hour
    && game.racks.some((r) => r.locationId === l.id && r.arriveAt === null && freeSlots(game, r.id, height).length));
  return targets.length ? [{ label: t("locations-1.moveTo"), items: targets.map((l) => ({ label: `${l.name}, ${euro(travelCost(game, here, l.id).price)}`, run: () => ui.move?.(l.id) })) }] : [];
}

// A rack device's actions, in the order of a Pear context menu: open, power, role, upgrades, then removal.
export function deviceMenu(game: GameState, d: Device, ui: DeviceUi): MenuEntry[] {
  const { act } = useStore.getState();
  const m = modelById(d.model), server = m.kind === "server";
  const cluster = server ? clusterOf(game, d.id) : undefined, node = cluster?.nodes.find((n) => n.deviceId === d.id);
  const loads = server ? workloadsOn(game, d.id) : [];
  const lease = d.lease ? game.leases.find((l) => l.id === d.lease) : undefined;
  const psuPrice = d.rackId ? secondPsuPrice(d) : null;
  return [
    ui.open && { label: t("locations-1.showDetails"), run: ui.open },
    null,
    ...(server && d.rackId ? serverPower(game, d, ui) : [
      m.kind !== "patch" && { label: d.on ? t("locations-1.powerOff") : t("locations-1.powerOn"), disabled: !d.rackId && !d.panel, run: () => ui.power(!d.on) },
      m.kind !== "patch" && d.on && !!pduOf(game, d) && { label: t("locations-1.powerCycle"), run: () => ui.op("cycle") },
      m.kind !== "patch" && !!(d.rackId || d.panel) && techItem(game, d.id, d.on ? "off" : "on"),
    ]),
    server && !!(d.rackId || d.store) && ui.lid && { label: t("locations-1.changeParts"), run: ui.lid },
    ...(server ? [] : psuEntries(d, ui)),
    null,
    server && !!d.rackId && ui.maintain && { label: t("locations-1.planMaintenance"), run: ui.maintain },
    server && !!d.rackId && !cluster && { label: t("locations-1.burnIn"), disabled: !d.on || burning(game, d) || loads.length > 0, items: [
      { label: t("locations-1.burnQuick"), run: () => act(startBurnin, d.id, false) },
      { label: t("locations-1.burnFull"), run: () => act(startBurnin, d.id, true) },
    ] },
    ...(server && d.rackId && ui.move ? moveEntries(game, d, ui) : []),
    cluster && consoleEntry(game, cluster.id),
    node && cluster && cluster.nodes.length > 1 && !loads.length && { label: t("locations-1.removeFromCluster"), run: () => act(removeNode, d.id) },
    null,
    psuPrice !== null && { label: t("locations-1.addSecondPsu", { price: euro(psuPrice) }), run: () => act(addSecondPsu, d.id) },
    lease && { label: t("locations-1.buyOutLease", { price: euro(lease.monthly * (lease.months - lease.paid)) }), run: () => act(buyOutLease, lease.id) },
    { label: t("locations-1.rename"), run: ui.rename },
    null,
    !!d.rackId && { label: t("locations-1.unmount"), run: ui.unmount },
    m.kind !== "gateway" && { label: t("locations-1.sell"), run: ui.sell },
  ];
}
