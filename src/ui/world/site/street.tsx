import { at3, Prism } from "../draw";
import { flat } from "./geo";
import { Model } from "./Model";
import { fnv1a, KERB, type Item } from "./layout";
import { CAR_TONES } from "./palette";

// A street running along x: asphalt, a kerb on both sides, a dashed centre line and one car passing on a CSS loop.
export function Street({ i, seed }: { i: Item; seed: number }) {
  const { x0, x1, y0, y1 } = i, mid = (y0 + y1) / 2, len = x1 - x0 - 60;
  const dash = (k: number) => `M${[[x0 + k * 6 + 1, mid - 0.07], [x0 + k * 6 + 4, mid - 0.07], [x0 + k * 6 + 4, mid + 0.07], [x0 + k * 6 + 1, mid + 0.07]].map(([x, y]) => { const p = at3(x, y, 0); return `${p.x} ${p.y}`; }).join("L")}Z`;
  const centre = Array.from({ length: Math.floor((x1 - x0) / 6) }, (_, k) => dash(k)).join("");
  return (
    <g pointerEvents="none">
      <polygon className="w-f-asphalt" points={flat(0, [x0, y0], [x1, y0], [x1, y1], [x0, y1])} />
      <path className="w-f-line" d={centre} />
      <Prism x0={x0} y0={y0 - KERB} x1={x1} y1={y0} z1={5} tone="w-tone-kerb" />
      <Prism x0={x0} y0={y1} x1={x1} y1={y1 + KERB} z1={5} tone="w-tone-kerb" />
      {i.moving && <g className="w-car-pass" style={{ ["--dx" as string]: `${len * 32}px`, ["--dy" as string]: `${len * 16}px` }}><Model id="sedan-x" x={x0 + 30} y={y0 + 1.5} tone={CAR_TONES[fnv1a(`${seed}:pass`) % 6]} /></g>}
    </g>
  );
}

// A sidewalk: paving with an expansion joint every 2 m, all in one path.
export function Walk({ i }: { i: Item }) {
  const { x0, x1, y0, y1 } = i;
  const joints = Array.from({ length: Math.floor((x1 - x0) / 2) }, (_, k) => flat(0, [x0 + 2 * k + 1, y0], [x0 + 2 * k + 1, y1]).replace(/ /g, "L").replace(/,/g, " ")).map((d) => `M${d}`).join("");
  return (
    <g pointerEvents="none">
      <polygon className="w-f-paving" points={flat(0, [x0, y0], [x1, y0], [x1, y1], [x0, y1])} />
      <path className="w-f-paving-line" d={joints} />
    </g>
  );
}

// A paved strip: a driveway is plain concrete across the sidewalk and the kerb, any other path has joints every metre.
export function Path({ i }: { i: Item }) {
  const { x0, x1, y0, y1 } = i, drive = i.kind === "drive";
  return (
    <g pointerEvents="none">
      <polygon className={drive ? "w-f-drive" : "w-f-paving"} points={flat(0, [x0, y0], [x1, y0], [x1, y1], [x0, y1])} />
      {!drive && <path className="w-f-paving-line" d={Array.from({ length: Math.floor(y1 - y0) }, (_, k) => `M${flat(0, [x0, y0 + k + 1], [x1, y0 + k + 1]).replace(/ /g, "L").replace(/,/g, " ")}`).join("")} />}
    </g>
  );
}
