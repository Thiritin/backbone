// A catalog model as a fake-3D picture: the real front face plus a top and a right side, seen from slightly above and left.
import type { DeviceModel } from "../../sim/10-catalog/hardware";
import { Defs, Front } from "./fronts";

interface Props { model: DeviceModel; brand: string; w?: number; count?: number }

// A 19-inch front is about 11 units wide per unit of height.
export function Isometric({ model, brand, w = 150, count = 1 }: Props) {
  const units = Math.max(1, model.height), u = Math.max(8, w / 10.9), h = units * u, dx = w * 0.16, dy = dx * 0.5;
  const copies = Math.min(3, Math.max(1, count)), step = 7, extra = (copies - 1) * step;
  const W = w + dx + extra + 2, H = h + dy + extra + 2 + (count > 1 ? 14 : 0);
  const box = (k: number) => {
    const x = 1 + (copies - 1 - k) * step, y = 1 + dy + k * step;
    return (
      <g key={k} transform={`translate(${x} ${y})`}>
        <path d={`M0 0L${dx} ${-dy}H${w + dx}L${w} 0z`} fill="oklch(0.46 0.008 255)" stroke="var(--metal-line)" strokeWidth="0.6" strokeLinejoin="round" />
        <path d={`M${w} 0L${w + dx} ${-dy}V${h - dy}L${w} ${h}z`} fill="oklch(0.2 0.006 255)" stroke="var(--metal-line)" strokeWidth="0.6" strokeLinejoin="round" />
        <Front model={model} brand={brand} name="" state="off" ports={[]} w={w} h={h} />
      </g>
    );
  };
  return (
    <svg className="device-svg iso" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={count > 1 ? `${count} × ${model.name}` : model.name}>
      <Defs />
      {Array.from({ length: copies }, (_, k) => box(k))}
      {count > 1 && <text x={W - 2} y={H - 2} textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600" fill="var(--text-2)">×{count}</text>}
    </svg>
  );
}
