import { GRID_DEBUG, GridDebug } from "./gridDebug";
import "./site.css";
import { memo } from "react";
import { t } from "../../../i18n/en";
import { Ground as GroundRect, GroundBack, SiteNight } from "./ground";
import { Street, Path, Walk } from "./street";
import { Bays } from "./parking";
import { Lobby } from "./lobby";
import { Yard, type Gear } from "./yard";
import { Bin, Sign } from "./decor";
import { Hedge } from "./hedge";
import { Booth, Cam, Fence, Gate, Light } from "./perimeter";
import { SettingGround } from "./scene";
import { BusStop, Container, Cooling, Dock, Generator, Lamp, Pallet, Planter, Rack, Substation, Tank } from "./utility";
import { Model, ModelDefs } from "./Model";
import { flat } from "./geo";
import type { Item, SiteSpec } from "./layout";

export { GroundRect, SiteNight };
export { SiteWeather } from "./weather";

// The spike's fixed yard: two transformers and a condenser.
const gear = (i: Item): Gear[] => [{ kind: "xfmr", x: i.x0 + 1.5, y: i.y0 + 1 }, { kind: "xfmr", x: i.x0 + 4.2, y: i.y0 + 1 }, { kind: "cond", x: i.x1 - 3, y: i.y0 + 1.2 }];

const PARKED: Drive = { anim: "" };
export interface Drive { anim: "" | "in" | "out"; onLeave?: (e: { stopPropagation(): void }) => void }

// The player's own car: the one site element that takes the pointer, a click leaves the location.
function PlayerCar({ i, drive }: { i: Item; drive: Drive }) {
  const label = t("world.site.car");
  return (
    <g className={`w-car${drive.anim ? ` w-car-${drive.anim}` : ""}`} role="button" tabIndex={0} aria-label={label} onClick={drive.onLeave} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") drive.onLeave?.(e); }}>
      <Model id={`${i.kind ?? "sedan"}-${i.dir ?? "x"}`} x={i.x0} y={i.y0} tone={i.tone} />
      <polygon className="w-car-hit" fill="transparent" points={flat(0, [i.x0, i.y0], [i.x1, i.y0], [i.x1, i.y1], [i.x0, i.y1])} />
    </g>
  );
}

// Body shapes by era: boxy until 2011, rounder after. Footprints stay close, so bays still fit.
const eraKind = (kind: string, year: number): string => (year < 2012 ? ({ coupe: "sedan" } as Record<string, string>)[kind] : ({ sedan: "coupe" } as Record<string, string>)[kind]) ?? kind;

function One({ i, s, name, band, year, drive }: { i: Item; s: SiteSpec; name: string; band: string; year: number; drive?: Drive }) {
  switch (i.t) {
    case "street": return <g aria-label={t("world.site.street")}><Street i={i} seed={s.seed} /></g>;
    case "path": return <Path i={i} />;
    case "bays": return <g aria-label={t("world.site.parking")}><Bays i={i} /></g>;
    case "walk": return <Walk i={i} />;
    case "car": return s.bay && i.x0 === s.bay.x && i.y0 === s.bay.y ? <PlayerCar i={i} drive={drive ?? PARKED} /> : <Model id={`${eraKind(i.kind ?? "sedan", year)}-${i.dir ?? "x"}`} x={i.x0} y={i.y0} tone={i.tone ?? "w-tone-car-1"} />;
    case "fence": return <Fence i={i} />;
    case "gate": return <Gate i={i} />;
    case "booth": return <Booth i={i} />;
    case "light": return <Light i={i} />;
    case "pole": return <Model id="pole" x={i.x0} y={i.y0} />;
    case "lobby": return <g aria-label={t("world.site.lobby")}><Lobby i={i} seats={s.seats} band={band} /></g>;
    case "yard": return <g aria-label={t("world.site.yard")}><Yard i={i} gear={gear(i)} /></g>;
    case "house": return <Model id={i.kind ?? "house"} x={i.x0} y={i.y0} tone={i.tone} />;
    case "box": return <Model id={i.kind ?? "warehouse"} x={i.x0} y={i.y0} tone={i.tone} />;
    case "bin": return <Bin i={i} />;
    case "hedge": return <Hedge i={i} />;
    case "sign": return <Sign i={i} name={name} />;
    case "tree": return <Model id={i.kind ?? "oak"} x={i.x0} y={i.y0} />;
    case "cam": return <Cam i={i} />;
    case "lamp": return <Lamp i={i} />;
    case "office": return <Model id={i.kind ?? "office-f"} x={i.x0} y={i.y0} tone={i.tone} />;
    case "landmark": return <Model id={i.kind ?? "chimney"} x={i.x0} y={i.y0} />;
    case "tank": return <Tank i={i} />;
    case "cont": return <Container i={i} />;
    case "pallet": return <Pallet i={i} />;
    case "subst": return <Substation i={i} />;
    case "gen": return <Generator i={i} />;
    case "dock": return <Dock i={i} />;
    case "cooling": return <Cooling i={i} />;
    case "planter": return <Planter i={i} />;
    case "rack": return <Rack i={i} />;
    case "busstop": return <BusStop i={i} />;
    case "turbine": return <Model id="windmill" x={i.x0} y={i.y0} />;
    case "solar": return year >= 2018 ? <>{Array.from({ length: Math.floor((i.x1 - i.x0) / 12) * Math.floor((i.y1 - i.y0) / 7) }, (_, k) => <Model key={k} id="solar" x={i.x0 + (k % Math.floor((i.x1 - i.x0) / 12)) * 12} y={i.y0 + Math.floor(k / Math.floor((i.x1 - i.x0) / 12)) * 7} />)}</> : null;
    default: return null;
  }
}

// Depth order: the street and flat things first, then everything by its front corner.
const flatFirst = (i: Item) => (i.t === "street" ? 0 : i.t === "walk" ? 1 : i.t === "path" || i.t === "bays" ? 2 : 3);
const sorted = (items: Item[]) => [...items].sort((a, b) => flatFirst(a) - flatFirst(b) || a.x1 + a.y1 - b.x1 - b.y1);

const Layer = ({ s, layer, name, band, year, drive }: { s: SiteSpec; layer: Item["layer"]; name: string; band: string; year: number; drive?: Drive }) => (
  <g className="w-site" pointerEvents="none" transform={layer === "back" && s.lift ? `translate(0 ${-s.lift})` : undefined}>
    {sorted(s.items.filter((i) => i.layer === layer)).map((i, k) => <One key={k} i={i} s={s} name={name} band={band} year={year} drive={drive ?? PARKED} />)}
    {GRID_DEBUG && <GridDebug s={s} layer={layer} />}
  </g>
);

// Behind the room's far walls: the ground plane and everything standing on it behind the room and beside it.
export const SiteBack = memo(function SiteBack({ s, name, band, month, year, drive }: { s: SiteSpec; name: string; band: string; month: number; year: number; drive?: Drive }) {
  return <>{s.kind !== "none" && <ModelDefs />}{s.kind === "plot" ? <SettingGround s={s} month={month} /> : <GroundBack s={s} />}<Layer s={s} layer="back" name={name} band={band} year={year} drive={drive} /></>;
});
// In front of the room: lobby, parking, street and the trees along them.
export const SiteFront = memo(function SiteFront({ s, name, band, year, drive }: { s: SiteSpec; name: string; band: string; year: number; drive?: Drive }) {
  return <Layer s={s} layer="front" name={name} band={band} year={year} drive={drive} />;
});
