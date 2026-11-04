import { useId } from "react";
import type { Geo } from "../travel/route";
import { XF, Y } from "./WorldMap";

type Paths = Record<keyof Geo, string> & { box: [number, number, number, number] };
const KEYS: (keyof Geo)[] = ["water", "waterway", "green", "built", "major", "second", "rail"];
const shape = (lines: [number, number][][], close: boolean) =>
  lines.map((r) => "M" + r.map(([lon, lat]) => `${XF(lon)} ${Y(lat)}`).join("L") + (close ? "Z" : "")).join("");

// Path data per layer; several cities merge by concatenation.
export const geoPaths = (geos: (Geo | null)[]): Paths | null => {
  const g = geos.filter((x): x is Geo => !!x);
  if (!g.length) return null;
  const pts = g.flatMap((x) => KEYS.flatMap((k) => x[k].flat()));
  const xs = pts.map(([lon]) => XF(lon)), ys = pts.map(([, lat]) => Y(lat));
  const box: Paths["box"] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return { ...(Object.fromEntries(KEYS.map((k) => [k, g.map((x) => shape(x[k], k === "water" || k === "green" || k === "built")).join("")])) as Omit<Paths, "box">), box };
};

// Street-level ground: land use and water under the streets, major roads and rail above them.
// The patch dissolves into the regional map as the view widens, and its edge is feathered.
export function GeoLayer({ geo, streets, opacity }: { geo: Paths | null; streets: string; opacity?: number }) {
  const id = useId().replace(/:/g, "");
  const [x0, y0, x1, y1] = geo?.box ?? [0, 0, 0, 0], f = Math.max(x1 - x0, y1 - y0) * 0.05;
  return (
    <g className="geo" style={opacity === undefined ? undefined : { opacity }}>
      {geo && <defs><filter id={`f${id}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={f} /></filter><mask id={`m${id}`} maskUnits="userSpaceOnUse" x={x0 - 4 * f} y={y0 - 4 * f} width={x1 - x0 + 8 * f} height={y1 - y0 + 8 * f}><rect x={x0 + f} y={y0 + f} width={x1 - x0 - 2 * f} height={y1 - y0 - 2 * f} fill="#fff" filter={`url(#f${id})`} /></mask></defs>}
      <g className="geo-patch" mask={geo ? `url(#m${id})` : undefined}>
      {geo && <><path className="geo-built" d={geo.built} /><path className="geo-green" d={geo.green} /><path className="geo-water" d={geo.water} /><path className="geo-waterway" d={geo.waterway} /></>}
      <path className="tr-streets-case" d={streets} /><path className="tr-streets" d={streets} />
      {geo && <>
        <path className="geo-rail" d={geo.rail} />
        <path className="geo-second-case" d={geo.second} /><path className="geo-second" d={geo.second} />
        <path className="geo-major-case" d={geo.major} /><path className="geo-major" d={geo.major} />
      </>}
      </g>
    </g>
  );
}
