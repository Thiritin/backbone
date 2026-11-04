import { Prism } from "../draw";
import { at3 } from "../draw";
import type { Item } from "./layout";

// A wheelie bin: dark body with a lid slab.
export const Bin = ({ i }: { i: Item }) => (
  <g pointerEvents="none">
    <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={26} tone="w-tone-bin" />
    <Prism x0={i.x0 - 0.04} y0={i.y0 - 0.04} x1={i.x1 + 0.04} y1={i.y1 + 0.04} z0={26} z1={30} tone="w-tone-binlid" />
  </g>
);

// A free standing sign with the company name on its lit face.
export function Sign({ i, name }: { i: Item; name: string }) {
  const p = at3(i.x0, i.y1, 34);
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0 + 0.2} y0={i.y0} x1={i.x0 + 0.3} y1={i.y1} z1={34} tone="w-tone-fence" />
      <Prism x0={i.x1 - 0.3} y0={i.y0} x1={i.x1 - 0.2} y1={i.y1} z1={34} tone="w-tone-fence" />
      <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z0={30} z1={i.top} tone="w-tone-sign" />
      <g transform={`matrix(1 0.5 0 1 ${p.x} ${p.y})`}><text className="w-sign-text" x={4} y={-6}>{name.slice(0, 16)}</text></g>
    </g>
  );
}
