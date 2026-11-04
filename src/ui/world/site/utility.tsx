import "./setting.css";
import { onY, Prism } from "../draw";
import { iso } from "../grid";
import { Transformer, Condenser } from "./yard";
import { M, type Item } from "./layout";

const CONT = ["w-tone-cont-a", "w-tone-cont-b", "w-tone-cont-c"];

// A shipping container: ribs on the long lit face.
export function Container({ i }: { i: Item }) {
  const len = (i.x1 - i.x0) * M, tone = CONT[Math.abs(Math.round(i.x0 * 3 + i.y0)) % 3];
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={i.top} tone={tone} />
      <g transform={onY(i.x0, i.y1, 0)}><path className="w-rib" d={Array.from({ length: Math.floor(len / 6) }, (_, k) => `M${k * 6 + 4} -4V${-i.top + 4}`).join("")} /></g>
    </g>
  );
}

// A fuel tank: a vertical cylinder in the three face tones.
export function Tank({ i }: { i: Item }) {
  const cx = (i.x0 + i.x1) / 2, cy = (i.y0 + i.y1) / 2, r = (i.x1 - i.x0) / 2, c = iso(cx, cy), rx = r * 32 * Math.SQRT2, ry = rx / 2, h = i.top;
  return (
    <g pointerEvents="none" className="w-box w-tone-tank">
      <path className="w-face-l" d={`M${c.x - rx} ${c.y}A${rx} ${ry} 0 0 0 ${c.x} ${c.y + ry}V${c.y + ry - h}A${rx} ${ry} 0 0 1 ${c.x - rx} ${c.y - h}Z`} />
      <path className="w-face-r" d={`M${c.x} ${c.y + ry}A${rx} ${ry} 0 0 0 ${c.x + rx} ${c.y}V${c.y - h}A${rx} ${ry} 0 0 1 ${c.x} ${c.y + ry - h}Z`} />
      <ellipse className="w-face-t" cx={c.x} cy={c.y - h} rx={rx} ry={ry} />
    </g>
  );
}

// Three transformers on a concrete pad.
export function Substation({ i }: { i: Item }) {
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={3} tone="w-tone-concrete" />
      {[0, 1, 2].map((k) => <Transformer key={k} x={i.x0 + 0.3 + k * 2.7} y={i.y0 + 0.5} />)}
    </g>
  );
}

// A generator container with an exhaust stack and louvres on the lit face.
export function Generator({ i }: { i: Item }) {
  const len = (i.x1 - i.x0) * M;
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={i.top} tone="w-tone-gen" />
      <Prism x0={i.x1 - 1} y0={i.y0 + 0.8} x1={i.x1 - 0.7} y1={i.y0 + 1.1} z0={i.top} z1={i.top + 28} tone="w-tone-fence" />
      <g transform={onY(i.x0, i.y1, 0)}><path className="w-rib" d={Array.from({ length: 6 }, (_, k) => `M${10 + k * 7} ${-14}V${-i.top + 14}`).join("")} /><rect className="w-glass-fill" x={len - 26} y={-i.top + 12} width={16} height={i.top - 24} /></g>
    </g>
  );
}

// A row of three condensers.
export const Cooling = ({ i }: { i: Item }) => <g pointerEvents="none">{[0, 1, 2].map((k) => <Condenser key={k} x={i.x0 + k * 2.5} y={i.y0 + 0.4} />)}</g>;

// A pallet stack of wood slats with a wrapped load.
export const Pallet = ({ i }: { i: Item }) => (
  <g pointerEvents="none">
    <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={5} tone="w-tone-wood-dark" />
    <Prism x0={i.x0 + 0.05} y0={i.y0 + 0.05} x1={i.x1 - 0.05} y1={i.y1 - 0.05} z0={5} z1={i.top} tone="w-tone-box" />
  </g>
);

// A loading dock: a raised concrete slab with two roller doors on the lit face.
export function Dock({ i }: { i: Item }) {
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={i.top} tone="w-tone-concrete" />
      <Prism x0={i.x0 + 0.4} y0={i.y0} x1={i.x0 + 3.6} y1={i.y0 + 0.5} z0={i.top} z1={i.top + 2.4 * M} tone="w-tone-cont-a" />
      <Prism x0={i.x0 + 4.4} y0={i.y0} x1={i.x1 - 0.4} y1={i.y0 + 0.5} z0={i.top} z1={i.top + 2.4 * M} tone="w-tone-cont-a" />
    </g>
  );
}

// A bus shelter: a roof on two posts above a glass back panel.
export function BusStop({ i }: { i: Item }) {
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y0 + 0.1} z1={i.top - 6} tone="w-tone-glass" />
      <Prism x0={i.x0 - 0.1} y0={i.y0 - 0.1} x1={i.x1 + 0.1} y1={i.y1} z0={i.top - 6} z1={i.top} tone="w-tone-roofslab" />
      <Prism x0={i.x0} y0={i.y1 - 0.15} x1={i.x0 + 0.12} y1={i.y1 - 0.03} z1={i.top - 6} tone="w-tone-fence" />
      <Prism x0={i.x1 - 0.12} y0={i.y1 - 0.15} x1={i.x1} y1={i.y1 - 0.03} z1={i.top - 6} tone="w-tone-fence" />
    </g>
  );
}

// A planter box with a shrub, or a bike rack: a rail on two feet.
export const Planter = ({ i }: { i: Item }) => (
  <g pointerEvents="none">
    <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={i.top} tone="w-tone-pot" />
    <Prism x0={i.x0 + 0.1} y0={i.y0 + 0.1} x1={i.x1 - 0.1} y1={i.y1 - 0.1} z0={i.top} z1={i.top + 14} tone="w-tone-shrub" />
  </g>
);
export const Rack = ({ i }: { i: Item }) => (
  <g pointerEvents="none">
    <Prism x0={i.x0} y0={i.y0} x1={i.x0 + 0.1} y1={i.y1} z1={i.top} tone="w-tone-fence" />
    <Prism x0={i.x1 - 0.1} y0={i.y0} x1={i.x1} y1={i.y1} z1={i.top} tone="w-tone-fence" />
    <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z0={i.top - 4} z1={i.top} tone="w-tone-fence" />
  </g>
);

// A street lamp: a slim post with a lamp head.
export const Lamp = ({ i }: { i: Item }) => (
  <g pointerEvents="none">
    <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={i.top} tone="w-tone-fence" />
    <Prism x0={i.x0 - 0.5} y0={i.y0 - 0.05} x1={i.x1 + 0.1} y1={i.y1 + 0.05} z0={i.top} z1={i.top + 5} tone="w-tone-fence" />
  </g>
);
