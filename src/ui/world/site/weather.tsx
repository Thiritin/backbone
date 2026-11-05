import type { ReactElement } from "react";
import { memo } from "react";
import type { Sky } from "../../../sim/20-world/weather";
import { fnv1a } from "./layout";

type View = { x: number; y: number; w: number; h: number };
const dots = (tag: string, n: number) => Array.from({ length: n }, (_, k) => ({ u: (fnv1a(`${tag}u${k}`) % 1000) / 1000, v: (fnv1a(`${tag}v${k}`) % 1000) / 1000 }));
const RAIN = dots("rain", 48), FLAKES = dots("flake", 16), LEAVES = dots("leaf", 10);

// Rain, snow and falling leaves over the viewport in screen space: fixed positions in two sets that alternate by opacity, so they move
// without moving geometry. Rain and snow show only outdoors; the leaves show in the fall palette.
const sameView = (a: View, b: View) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
export const SiteWeather = memo(function SiteWeather({ sky, night, falling, view }: { sky: Sky; night: boolean; falling: boolean; view: View }) {
  const u = view.w / 900, rain = sky === "rain", snow = sky === "snow";
  if (!rain && !snow && !falling) return null;
  const sets = (list: typeof RAIN, mark: (x: number, y: number) => ReactElement) => [0, 1].map((s) => (
    <g key={s} className={`w-wx-${"ab"[s]}`}>{list.filter((_, k) => k % 2 === s).map((p, k) => <g key={k}>{mark(view.x + p.u * view.w, view.y + p.v * view.h)}</g>)}</g>
  ));
  return (
    <g pointerEvents="none" aria-hidden>
      {rain && sets(RAIN, (x, y) => <path className={`w-wx-rain${night ? " w-wx-night" : ""}`} d={`M${x} ${y}l${-2 * u} ${9 * u}`} strokeWidth={0.9 * u} />)}
      {snow && sets(FLAKES, (x, y) => <rect className="w-wx-flake" x={x} y={y} width={2.4 * u} height={2.4 * u} />)}
      {falling && sets(LEAVES, (x, y) => <path className={`w-wx-leaf w-wx-leaf-${Math.floor(x) % 3}`} d={`M${x} ${y}l${7 * u} ${3 * u}l${-2 * u} ${6 * u}z`} />)}
    </g>
  );
}, (a, b) => a.sky === b.sky && a.night === b.night && a.falling === b.falling && sameView(a.view, b.view));
