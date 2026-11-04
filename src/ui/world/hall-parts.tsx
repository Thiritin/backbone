// GDD, Own datacenter, Edit mode: the parts strip along the bottom edge. Six tabs of parts to hold, the hall's meters and the way out.
import type { ReactNode } from "react";
import { t } from "../../i18n/en";
import { euro } from "../../sim/00-core/money";
import { yearOf } from "../../sim/00-core/time";
import { RACK_MODELS } from "../../sim/20-world/datacenters";
import { HALL, hallCapacity, hallKw, hallSpots, isHalle } from "../../sim/20-world/properties";
import { airflow } from "../../sim/60-infra/airflow";
import { roomPower } from "../../sim/60-infra/status";
import type { HallItemKind, Location } from "../../sim/50-state";
import { hallAt } from "../../sim/90-actions/hall";
import { useStore } from "../store";
import { pts, rackHeight, RackBox } from "./draw";
import { iso } from "./grid";
import { Battery, Containment, Crac, CratedRack, Generator, Switchgear, Transformer, Ups, Vent } from "./hall-art";
import { entryOf, useEdit, type Spec, type Tab } from "./hall-edit";

const TABS: Tab[] = ["racks", "cooling", "areas", "power", "delivered"];
// Space above the footprint the art needs in the small view.
const TOP: Partial<Record<HallItemKind, number>> = { vent: 6, containment: 76, crac: 62, battery: 70, ups: 72 };

interface Part { id: string; spec: Spec; label: string; price: number | null; art: ReactNode; box: string }

function itemBox(kind: HallItemKind, fw: number, fh: number): string {
  const top = TOP[kind] ?? 100, x0 = iso(0, fh).x - 4, w = iso(fw, 0).x - x0 + 4;
  return `${x0} ${-top} ${w} ${top + iso(fw, fh).y + 8}`;
}

function ItemArt({ kind, halle }: { kind: HallItemKind; halle: boolean }) {
  const p = { x: 0, y: 0, facing: "s" as const };
  switch (kind) {
    case "crac": return <Crac {...p} />;
    case "vent": return <Vent x={0} y={0} reach />;
    case "containment": return <Containment x={0} y={0} endN endS />;
    case "transformer": return <Transformer {...p} size={halle ? "halle" : "office"} />;
    case "switchgear": return <Switchgear {...p} />;
    case "generator": return <Generator {...p} />;
    case "ups": return <Ups {...p} running={false} />;
    case "battery": return <Battery {...p} />;
    default: return null;
  }
}

// Height of the strip below the room: the tabs, the part art, its label and price, and the padding.
export const STRIP_H = 150;
const ART_H = 52;
// The parts strip along the bottom edge of the room: parts to hold, the hall's meters, and the way out of edit mode.
export function HallStrip({ loc, onDone }: { loc: Location; onDone: () => void }) {
  const game = useStore((s) => s.game), { hold, onStrip, tab } = useEdit();
  const h = hallAt(game, loc.id);
  if (!h) return null;
  const halle = isHalle(h.p.buildingId), year = yearOf(game.hour);
  const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const cap = hallCapacity(h.p), used = hallSpots(h.hall, Object.fromEntries(game.racks.filter((r) => r.locationId === loc.id).map((r) => [r.id, r.tile ?? null])));
  const heat = roomPower(game, loc).watts / 1000, air = airflow(game, loc);
  const delivered = game.racks.filter((r) => r.locationId === loc.id && !r.tile);
  const tabs = TABS.filter((k) => k !== "delivered" || delivered.length > 0);
  const active: Tab = tabs.includes(tab) ? tab : "racks";
  const rackBox = `-34 ${-rackHeight(47) - 8} 68 ${rackHeight(47) + 44}`;

  const item = (kind: HallItemKind): Part => {
    const e = entryOf({ kind }, "s", halle);
    return { id: kind, spec: { kind }, label: t(`hall.item.${kind}`), price: HALL.items[kind].price, art: <ItemArt kind={kind} halle={halle} />, box: itemBox(kind, e.fw, e.fh) };
  };
  const zone = (z: "colo" | "cage" | "meetme"): Part => ({
    id: z, spec: { kind: "zone", zone: z }, label: t(`hall.edit.${z}`), price: z === "colo" ? null : z === "cage" ? HALL.zones.cage.perPosition : HALL.zones.meetme.price, box: "-40 -2 140 66",
    art: <>{[0, 1, 2].map((i) => <polygon key={i} className={`w-zone-${z}`} points={pts(iso(i, 0.2), iso(i + 1, 0.2), iso(i + 1, 1.2), iso(i, 1.2))} />)}<polygon className={`w-zone-edge w-zone-edge-${z}`} points={pts(iso(0, 0.2), iso(3, 0.2), iso(3, 1.2), iso(0, 1.2))} /></>,
  });
  const rack = (m: { id: string; units: number; price: number }): Part => ({
    id: m.id, spec: { kind: "rack", model: m.id, units: m.units }, label: t("hall.edit.rack", { u: m.units }), price: m.price, box: rackBox,
    art: <RackBox tile={{ x: 0, y: 0, facing: "s" }} units={m.units} items={[]} leds={[]} zoomed={false} />,
  });
  const parts: Record<Tab, Part[]> = {
    racks: RACK_MODELS.filter((m) => m.id !== "shelf").map(rack),
    cooling: [item("crac"), item("vent"), ...(year >= (HALL.items.containment.from ?? 0) ? [item("containment")] : [])],
    areas: (["colo", "cage", "meetme"] as const).filter((z) => z !== "cage" || year >= HALL.zones.cage.from).map(zone),
    power: (["transformer", "switchgear", "generator", "ups", "battery"] as const).map(item),
    delivered: delivered.map((r) => ({ id: r.id, spec: { kind: "rack" as const, model: r.model, units: 42, rackId: r.id }, label: r.name, price: null, box: itemBox("vent", 1, 1).replace(/-?\d+ \d+ (\d+) \d+$/, "-34 -80 68 96"), art: <CratedRack x={0} y={0} /> })),
  };
  const pick = (p: Part) => (e: React.PointerEvent) => {
    if (e.button) return;
    e.preventDefault();
    const same = hold && !hold.moving && JSON.stringify(hold.entries[0].spec) === JSON.stringify(p.spec);
    useEdit.getState().open(loc.id, same ? null : { entries: [entryOf(p.spec, "s", halle)], anchor: { x: 0, y: 0 }, moving: false });
  };
  return (
    <div className={`w-parts${onStrip && hold?.moving ? " w-parts-drop" : ""}`} data-strip>
      <div className="w-parts-tabs" role="tablist">
        {tabs.map((k) => <button key={k} role="tab" aria-selected={k === active} className={k === active ? "w-parts-tab w-parts-tab-on" : "w-parts-tab"} onClick={() => useEdit.setState({ tab: k })}>{t(`hall.tab.${k}`)}</button>)}
      </div>
      <div className="w-parts-row">
        {parts[active].map((p) => (
          <div key={p.id} className={`w-parts-item${hold && !hold.moving && JSON.stringify(hold.entries[0].spec) === JSON.stringify(p.spec) ? " w-parts-on" : ""}`} onPointerDown={pick(p)} role="button" aria-label={p.label}>
            <svg className="w-parts-art" height={ART_H} viewBox={p.box} aria-hidden>{p.art}</svg>
            <span>{p.label}</span>{p.price !== null && <b className="num">{euro(p.price)}</b>}
          </div>
        ))}
        <div className="w-parts-meters num">
          <span>{t("hall.edit.kw", { used: n(heat), max: n(hallKw(h.p)) })}</span>
          <span>{t("hall.edit.cooling", { cool: n(air.effective), heat: n(heat) })}</span>
          <span>{t("hall.edit.efficiency", { v: n(air.efficiency * 100) })}</span>
          <span>{t("hall.edit.pue", { v: air.pue.toFixed(2) })}</span>
          {air.hot > 0 && <span>{t("hall.edit.hot", { n: air.hot })}</span>}
          <span>{t("hall.edit.places", { used: n(used), cap: n(cap) })}</span>
        </div>
        <button className="w-parts-done" onClick={onDone}>{t("hall.edit.done")}</button>
      </div>
    </div>
  );
}
