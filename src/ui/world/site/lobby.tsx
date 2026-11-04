import type { CSSProperties } from "react";
import { add, at3, pts, Prism, up, WALL, WallBand } from "../draw";
import { iso } from "../grid";
import { flat } from "./geo";
import type { Item, Seat } from "./layout";

const Chair = ({ x, y }: { x: number; y: number }) => (
  <g>
    <Prism x0={x - 0.3} y0={y - 0.3} x1={x + 0.3} y1={y + 0.3} z0={9} z1={13} tone="w-tone-fabric" />
    <Prism x0={x - 0.3} y0={y - 0.3} x1={x + 0.3} y1={y - 0.2} z0={13} z1={26} tone="w-tone-fabric" />
    <Prism x0={x - 0.05} y0={y - 0.05} x1={x + 0.05} y1={y + 0.05} z1={9} tone="w-tone-fence" />
  </g>
);

// The lobby is one building with the hall: its left wall continues the hall's far wall at full height with the same colour band, the near sides are knee walls as in the room art, and the entrance door faces the street.
export function Lobby({ i, seats, band }: { i: Item; seats: Seat[]; band: string }) {
  const { x0, y0, x1, y1 } = i, O = iso(x0, y0), S = iso(x0, y0 - 0.6), Y = iso(x0, y1), out = iso(-0.25, 0), dx0 = 3.4, dx1 = 4.8;
  const tiles = Array.from({ length: x1 - x0 - 1 }, (_, k) => `M${at3(x0 + k + 1, y0, 0).x} ${at3(x0 + k + 1, y0, 0).y}L${at3(x0 + k + 1, y1, 0).x} ${at3(x0 + k + 1, y1, 0).y}`).join("") + Array.from({ length: y1 - y0 - 1 }, (_, k) => `M${at3(x0, y0 + k + 1, 0).x} ${at3(x0, y0 + k + 1, 0).y}L${at3(x1, y0 + k + 1, 0).x} ${at3(x1, y0 + k + 1, 0).y}`).join("");
  return (
    <g aria-hidden pointerEvents="none">
      <polygon className="w-f-lobby" points={flat(0, [x0, y0], [x1, y0], [x1, y1], [x0, y1])} />
      <path className="w-f-lobby-line" d={tiles} />
      <polygon className="w-f-threshold" points={flat(0, [x0, y0 - 0.1], [x1, y0 - 0.1], [x1, y0 + 0.3], [x0, y0 + 0.3])} />
      <g className="w-walls" style={{ "--band": band } as CSSProperties}>
        <polygon className="w-wall-l" style={{ stroke: "none" }} points={pts(O, add(O, out), up(add(O, out), WALL), up(O, WALL))} />
        <polygon className="w-wall-l" style={{ stroke: "none" }} points={pts(S, Y, up(Y, WALL), up(S, WALL))} />
        <WallBand a={S} b={Y} />
        <polygon className="w-skirt" points={pts(S, Y, up(Y, 3), up(S, 3))} />
        <polygon className="w-wall-end" points={pts(Y, add(Y, out), up(add(Y, out), WALL), up(Y, WALL))} />
        <polygon className="w-wall-top" points={pts(up(O, WALL), up(Y, WALL), add(up(Y, WALL), out), add(up(O, WALL), out))} />
      </g>
      <Prism x0={x0} y0={y1 - 0.2} x1={dx0} y1={y1} z1={16} tone="w-tone-plaster-a" />
      <Prism x0={dx1} y0={y1 - 0.2} x1={x1} y1={y1} z1={16} tone="w-tone-plaster-a" />
      <Prism x0={x1 - 0.2} y0={y0} x1={x1} y1={y1} z1={16} tone="w-tone-plaster-a" />
      {[x0 + 0.1, 2, 6, x1 - 0.1].map((x) => <Prism key={x} x0={x - 0.1} y0={y1 - 0.2} x1={x + 0.1} y1={y1} z1={70} tone="w-tone-fence" />)}
      {[y0 + 0.1, y0 + 2.5, y1 - 0.1].map((y) => <Prism key={y} x0={x1 - 0.2} y0={y - 0.1} x1={x1} y1={y + 0.1} z1={70} tone="w-tone-fence" />)}
      <Prism x0={x0} y0={y1 - 0.2} x1={x1} y1={y1} z0={44} z1={47} tone="w-tone-fence" />
      <Prism x0={x0} y0={y1 - 0.2} x1={x1} y1={y1} z0={68} z1={71} tone="w-tone-fence" />
      <Prism x0={x1 - 0.2} y0={y0} x1={x1} y1={y1} z0={44} z1={47} tone="w-tone-fence" />
      <Prism x0={x1 - 0.2} y0={y0} x1={x1} y1={y1} z0={68} z1={71} tone="w-tone-fence" />
      <Prism x0={x0 + 0.1} y0={y1 - 0.12} x1={x1 - 0.1} y1={y1 - 0.08} z0={47} z1={68} tone="w-tone-glass" />
      <Prism x0={x1 - 0.12} y0={y0} x1={x1 - 0.08} y1={y1} z0={47} z1={68} tone="w-tone-glass" />
      <Prism x0={x0} y0={y1 - 0.25} x1={x1} y1={y1} z0={71} z1={78} tone="w-tone-plaster-a" />
      <Prism x0={x1 - 0.25} y0={y0} x1={x1} y1={y1} z0={71} z1={78} tone="w-tone-plaster-a" />
      <Prism x0={dx0} y0={y1 - 0.2} x1={dx1} y1={y1 - 0.1} z1={64} tone="w-tone-door" />
      <Prism x0={dx0 - 0.15} y0={y1 - 0.25} x1={dx0} y1={y1} z1={68} tone="w-tone-fence" />
      <Prism x0={dx1} y0={y1 - 0.25} x1={dx1 + 0.15} y1={y1} z1={68} tone="w-tone-fence" />
      <Prism x0={dx0 - 0.15} y0={y1 - 0.25} x1={dx1 + 0.15} y1={y1} z0={64} z1={68} tone="w-tone-fence" />
      <Prism x0={dx0 - 0.2} y0={y1} x1={dx1 + 0.2} y1={y1 + 0.6} z1={4} tone="w-tone-concrete" />
      <Prism x0={x0 + 0.8} y0={y0 + 0.5} x1={x0 + 3.2} y1={y0 + 1.4} z1={30} tone="w-tone-wood" />
      <Prism x0={x0 + 0.9} y0={y0 + 0.55} x1={x0 + 1.5} y1={y0 + 1.0} z0={30} z1={43} tone="w-tone-pc" />
      {[...seats].sort((a, b) => a.x + a.y - b.x - b.y).map((s, k) => <Chair key={k} x={s.x} y={s.y} />)}
      <Prism x0={x1 - 1} y0={y1 - 1} x1={x1 - 0.5} y1={y1 - 0.5} z1={9} tone="w-tone-card" />
      <ellipse className="m-leaf f-l" cx={at3(x1 - 0.75, y1 - 0.75, 22).x} cy={at3(x1 - 0.75, y1 - 0.75, 22).y} rx={11} ry={13} />
      <ellipse className="m-leaf f-t" cx={at3(x1 - 0.75, y1 - 0.75, 26).x - 3} cy={at3(x1 - 0.75, y1 - 0.75, 26).y - 3} rx={7} ry={8} />
    </g>
  );
}
