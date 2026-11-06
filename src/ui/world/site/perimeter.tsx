import { t } from "../../../i18n/en";
import { onX, onY, Prism } from "../draw";
import { M, type Item } from "./layout";

const MESH = 2.4 * M, POST = 2.85 * M, GAP = 2.5 * M;

// One 5 m run of the security fence: posts every 2.5 m, diagonal mesh, a V outrigger and a razor coil along the top. It sits in the plane of the run.
export function Fence({ i }: { i: Item }) {
  const along = i.dir === "y", len = (along ? i.y1 - i.y0 : i.x1 - i.x0) * M, plane = along ? onX(i.x0, i.y1, 0) : onY(i.x0, i.y0, 0);
  const gaps = Math.max(1, Math.ceil(len / GAP - 1e-6)), posts = Array.from({ length: gaps + 1 }, (_, k) => (k * len) / gaps);
  const coil = i.coil ? "M" + Array.from({ length: Math.floor(len / 5) }, (_, k) => `${k * 5 + 5} ${-POST - 3}a4.5 4.5 0 1 1 -9 0a4.5 4.5 0 1 1 9 0`).join("M") : "";
  return (
    <g pointerEvents="none" transform={plane}>
      <rect className="w-mesh" x={0} y={-MESH} width={len} height={MESH} />
      <path className="w-rail" d={`M0 ${-MESH}H${len}M0 -2H${len}`} />
      <path className="w-fpost" d={posts.map((x) => `M${x - 1.2} 0V${-POST}h2.4V0Z`).join("")} />
      <path className="w-rail" d={posts.map((x) => `M${x} ${-MESH}l7 ${-0.45 * M}`).join("")} />
      {i.coil && <path className="w-coil" d={coil} />}
    </g>
  );
}

// The gate: two heavy posts with a sliding leaf drawn open beside them and a striped barrier arm across the lane.
export function Gate({ i }: { i: Item }) {
  if (i.kind === "door") return (
    <g pointerEvents="none">
      <Prism x0={i.x0 - 0.15} y0={i.y0} x1={i.x0 + 0.15} y1={i.y0 + 0.3} z1={2.6 * M} tone="w-tone-fence" />
      <Prism x0={i.x1 - 0.15} y0={i.y0} x1={i.x1 + 0.15} y1={i.y0 + 0.3} z1={2.6 * M} tone="w-tone-fence" />
      <Prism x0={i.x0 + 0.15} y0={i.y0 - 2.6} x1={i.x0 + 0.25} y1={i.y0} z1={2.2 * M} tone="w-tone-fence" />
    </g>
  );
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0 - 0.15} y0={i.y0} x1={i.x0 + 0.15} y1={i.y0 + 0.3} z1={3 * M} tone="w-tone-concrete" />
      <Prism x0={i.x1 - 0.15} y0={i.y0} x1={i.x1 + 0.15} y1={i.y0 + 0.3} z1={3 * M} tone="w-tone-concrete" />
      {i.kind === "slide" && <Fence i={{ ...i, x0: i.x0 + (i.x1 - i.x0) * 0.55, x1: i.x1 - 0.15, y0: i.y0 + 0.45, y1: i.y0 + 0.55, dir: "x", coil: false }} />}
      <Prism x0={i.x0 + 0.4} y0={i.y0 - 1.5} x1={i.x1 - 0.4} y1={i.y0 - 1.4} z0={1 * M} z1={1 * M + 4} tone="w-tone-barrier" />
      <Prism x0={i.x0 + 0.1} y0={i.y0 - 1.6} x1={i.x0 + 0.5} y1={i.y0 - 1.2} z1={1 * M} tone="w-tone-concrete" />
    </g>
  );
}

// The gate house: a small flat roofed box with a window strip on the two lit sides.
export function Booth({ i }: { i: Item }) {
  const w = (i.x1 - i.x0) * M, d = (i.y1 - i.y0) * M;
  return (
    <g pointerEvents="none">
      <Prism x0={i.x0} y0={i.y0} x1={i.x1} y1={i.y1} z1={2.6 * M} tone="w-tone-concrete" />
      <Prism x0={i.x0 - 0.2} y0={i.y0 - 0.2} x1={i.x1 + 0.2} y1={i.y1 + 0.2} z0={2.6 * M} z1={2.75 * M} tone="w-tone-roofslab" />
      <g transform={onY(i.x0, i.y1, 0)}><rect className="w-glass-fill" x={6} y={-2.1 * M} width={w - 12} height={0.9 * M} /></g>
      <g transform={onX(i.x1, i.y0, 0)}><rect className="w-glass-fill" x={6} y={-2.1 * M} width={d - 12} height={0.9 * M} /></g>
    </g>
  );
}

// A floodlight pole with a wide lamp head.
export function Light({ i }: { i: Item }) {
  const x = (i.x0 + i.x1) / 2, y = (i.y0 + i.y1) / 2;
  return (
    <g pointerEvents="none">
      <Prism x0={x - 0.12} y0={y - 0.12} x1={x + 0.12} y1={y + 0.12} z1={i.top} tone="w-tone-fence" />
      <Prism x0={x - 0.6} y0={y - 0.2} x1={x + 0.6} y1={y + 0.2} z0={i.top} z1={i.top + 6} tone="w-tone-fence" />
    </g>
  );
}

// A camera pole with a slim head; the pole at the gate carries a surveillance plate on the lit face.
export function Cam({ i }: { i: Item }) {
  const x = (i.x0 + i.x1) / 2, y = (i.y0 + i.y1) / 2;
  return (
    <g pointerEvents="none">
      <Prism x0={x - 0.1} y0={y - 0.1} x1={x + 0.1} y1={y + 0.1} z1={i.top} tone="w-tone-fence" />
      <Prism x0={x - 0.5} y0={y - 0.12} x1={x + 0.1} y1={y + 0.12} z0={i.top - 5} z1={i.top + 3} tone="w-tone-dark" />
      {i.kind === "gate" && (
        <>
          <Prism x0={x - 0.9} y0={y + 0.1} x1={x + 0.9} y1={y + 0.16} z0={1.4 * M} z1={2 * M} tone="w-tone-sign" />
          <g transform={onY(x - 0.9, y + 0.16, 1.4 * M)}><text className="w-cctv-text" x={3} y={-0.2 * M}>{t("world.site.cctv")}</text></g>
        </>
      )}
    </g>
  );
}
