import { flat } from "./geo";
import { BAY, type Item } from "./layout";

// Bays as paint lines along y, 2.5 m wide and 5 m long; the cars stand in them as separate items.
export function Bays({ i }: { i: Item }) {
  const n = i.count ?? 4, ys = Array.from({ length: n + 1 }, (_, k) => i.y0 + BAY.w * k);
  const line = (y: number) => `M${flat(0, [i.x0, y - 0.05], [i.x1, y - 0.05], [i.x1, y + 0.05], [i.x0, y + 0.05]).split(" ").join("L")}Z`;
  return (
    <g pointerEvents="none">
      <polygon className="w-f-asphalt" points={flat(0, [i.x0 - 0.4, ys[0] - 0.6], [i.x1 + 0.4, ys[0] - 0.6], [i.x1 + 0.4, ys[n] + 0.6], [i.x0 - 0.4, ys[n] + 0.6])} />
      <path className="w-f-line" d={ys.map(line).join("")} />
    </g>
  );
}
