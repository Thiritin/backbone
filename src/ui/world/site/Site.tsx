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
import { Booth, Fence, Gate, Light } from "./perimeter";
import { Model, ModelDefs } from "./Model";
import type { Item, SiteSpec } from "./layout";

export { GroundRect, SiteNight };

// The spike's fixed yard: two transformers and a condenser.
const gear = (i: Item): Gear[] => [{ kind: "xfmr", x: i.x0 + 1.5, y: i.y0 + 1 }, { kind: "xfmr", x: i.x0 + 4.2, y: i.y0 + 1 }, { kind: "cond", x: i.x1 - 3, y: i.y0 + 1.2 }];

function One({ i, s, name, band }: { i: Item; s: SiteSpec; name: string; band: string }) {
  switch (i.t) {
    case "street": return <g aria-label={t("world.site.street")}><Street i={i} seed={s.seed} /></g>;
    case "path": return <Path i={i} />;
    case "bays": return <g aria-label={t("world.site.parking")}><Bays i={i} /></g>;
    case "walk": return <Walk i={i} />;
    case "car": return <Model id={`${i.kind ?? "sedan"}-${i.dir ?? "x"}`} x={i.x0} y={i.y0} tone={i.tone ?? "w-tone-car-1"} />;
    case "fence": return <Fence i={i} />;
    case "gate": return <Gate i={i} />;
    case "booth": return <Booth i={i} />;
    case "light": return <Light i={i} />;
    case "pole": return <Model id="pole" x={i.x0} y={i.y0} />;
    case "lobby": return <g aria-label={t("world.site.lobby")}><Lobby i={i} seats={s.seats} band={band} /></g>;
    case "yard": return <g aria-label={t("world.site.yard")}><Yard i={i} gear={gear(i)} /></g>;
    case "house": return <Model id="house" x={i.x0} y={i.y0} tone={i.tone} />;
    case "box": return <Model id="warehouse" x={i.x0} y={i.y0} tone={i.tone} />;
    case "bin": return <Bin i={i} />;
    case "hedge": return <Hedge i={i} />;
    case "sign": return <Sign i={i} name={name} />;
    case "tree": return <Model id={i.kind ?? "oak"} x={i.x0} y={i.y0} />;
  }
}

// Depth order: the street and flat things first, then everything by its front corner.
const flatFirst = (i: Item) => (i.t === "street" ? 0 : i.t === "walk" ? 1 : i.t === "path" || i.t === "bays" ? 2 : 3);
const sorted = (items: Item[]) => [...items].sort((a, b) => flatFirst(a) - flatFirst(b) || a.x1 + a.y1 - b.x1 - b.y1);

const Layer = ({ s, layer, name, band }: { s: SiteSpec; layer: Item["layer"]; name: string; band: string }) => (
  <g className="w-site" pointerEvents="none" transform={layer === "back" && s.lift ? `translate(0 ${-s.lift})` : undefined}>
    {sorted(s.items.filter((i) => i.layer === layer)).map((i, k) => <One key={k} i={i} s={s} name={name} band={band} />)}
  </g>
);

// Behind the room's far walls: the ground plane and everything standing on it behind the room and beside it.
export const SiteBack = memo(function SiteBack({ s, name, band }: { s: SiteSpec; name: string; band: string }) {
  return <>{s.kind !== "none" && <ModelDefs />}<GroundBack s={s} /><Layer s={s} layer="back" name={name} band={band} /></>;
});
// In front of the room: lobby, parking, street and the trees along them.
export const SiteFront = memo(function SiteFront({ s, name, band }: { s: SiteSpec; name: string; band: string }) {
  return <Layer s={s} layer="front" name={name} band={band} />;
});
