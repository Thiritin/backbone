import { at3, pts } from "../draw";
import { M, fnv1a, type Item } from "./layout";

// A trimmed hedge along x, built from 1 m sections with a chamfered top and a seeded step in height, so the top reads as clipped.
export function Hedge({ i }: { i: Item }) {
  const n = Math.max(1, Math.round(i.x1 - i.x0)), c = 0.18, d = i.y1 - i.y0, base = i.top;
  return (
    <g pointerEvents="none" className="m-leaf">
      {Array.from({ length: n }, (_, k) => {
        const x0 = i.x0 + k, x1 = x0 + 1, z = base - 3 + (fnv1a(`${i.seed}:${k}`) % 4) * 2, zc = z - c * M;
        return (
          <g key={k}>
            <polygon className="f-r" points={pts(at3(x1, i.y0, 0), at3(x1, i.y1 - c, 0), at3(x1, i.y1 - c, z), at3(x1, i.y0, z))} />
            <polygon className="f-l" points={pts(at3(x0, i.y1, 0), at3(x1, i.y1, 0), at3(x1, i.y1, zc), at3(x0, i.y1, zc))} />
            <polygon className="f-c" points={pts(at3(x0, i.y1, zc), at3(x1, i.y1, zc), at3(x1, i.y1 - c, z), at3(x0, i.y1 - c, z))} />
            <polygon className="f-t" points={pts(at3(x0, i.y0, z), at3(x1, i.y0, z), at3(x1, i.y1 - c, z), at3(x0, i.y1 - c, z))} />
            {k === n - 1 && d > c && <polygon className="f-r" points={pts(at3(x1, i.y1 - c, zc), at3(x1, i.y1, zc), at3(x1, i.y1, 0), at3(x1, i.y1 - c, 0))} />}
          </g>
        );
      })}
    </g>
  );
}
