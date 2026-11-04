import type { Geo } from "../travel/route";
import { XF, Y } from "./WorldMap";

type Paths = Record<keyof Geo, string>;
const KEYS: (keyof Geo)[] = ["water", "waterway", "green", "built", "major", "second", "rail"];
const shape = (lines: [number, number][][], close: boolean) =>
  lines.map((r) => "M" + r.map(([lon, lat]) => `${XF(lon)} ${Y(lat)}`).join("L") + (close ? "Z" : "")).join("");

// Path data per layer; several cities merge by concatenation.
export const geoPaths = (geos: (Geo | null)[]): Paths | null => {
  const g = geos.filter((x): x is Geo => !!x);
  if (!g.length) return null;
  return Object.fromEntries(KEYS.map((k) => [k, g.map((x) => shape(x[k], k === "water" || k === "green" || k === "built")).join("")])) as Paths;
};

// Street-level ground: land use and water under the streets, major roads and rail above them.
export function GeoLayer({ geo, streets, opacity }: { geo: Paths | null; streets: string; opacity?: number }) {
  return (
    <g className="geo" style={opacity === undefined ? undefined : { opacity }}>
      {geo && <><path className="geo-built" d={geo.built} /><path className="geo-green" d={geo.green} /><path className="geo-water" d={geo.water} /><path className="geo-waterway" d={geo.waterway} /></>}
      <path className="tr-streets-case" d={streets} /><path className="tr-streets" d={streets} />
      {geo && <>
        <path className="geo-rail" d={geo.rail} />
        <path className="geo-second-case" d={geo.second} /><path className="geo-second" d={geo.second} />
        <path className="geo-major-case" d={geo.major} /><path className="geo-major" d={geo.major} />
      </>}
    </g>
  );
}
