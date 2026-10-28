// Rear panels and the place of every port on either side, so cables can be drawn to them.
import { PATCH_JACKS, type DeviceModel } from "../../sim/10-catalog/hardware";
import { fsz, gatewayLayout, Jacks, LED, patchLayout, switchLayout, tw, type FrontProps } from "./fronts";

export type Side = "front" | "back";
export interface Spot { x: number; y: number; w: number; h: number }

const MONO = "JetBrains Mono, monospace";

// Server NICs sit in the lowest unit on the left; PSUs stand at the right edge.
function nicLayout(model: DeviceModel, w: number, h: number): Map<number, Spot> {
  const u = h / model.height, ph = Math.min(u - 6, 10), y = h - u + (u - ph) / 2;
  let x = w * 0.3;
  return new Map(model.ports.map((p, i) => {
    const pw = p.media === "sfp" ? 12 : 9, at = { x, y, w: pw, h: ph };
    x += pw + 3;
    return [i, at];
  }));
}

export function portSpots(model: DeviceModel, name: string, side: Side, w: number, h: number): Map<number, Spot> {
  if (side === "back") {
    if (model.kind === "server") return nicLayout(model, w, h);
    if (model.kind === "patch") return new Map(patchLayout(name, w, h).map((p, k) => [PATCH_JACKS + k, p]));
    return new Map();
  }
  if (model.kind === "switch") {
    const fs = fsz(Math.min(h, 24)) * 0.9;
    return switchLayout(model, w, h, name ? 18 + tw(name, fs) : 16);
  }
  if (model.kind === "gateway") return gatewayLayout(model, name, w, h);
  if (model.kind === "patch") return new Map(patchLayout(name, w, h).map((p, k) => [k, p]));
  return new Map();
}

function Psus({ model, w, h, on }: { model: DeviceModel; w: number; h: number; on: boolean }) {
  const u = h / model.height, ph = u - 4, pw = Math.min(30, ph * 2.2);
  return (
    <>
      {Array.from({ length: model.psus }, (_, k) => {
        const x = w - 6 - (k + 1) * (pw + 3), y = h - u + 2;
        return (
          <g key={k} aria-label={`PSU ${k + 1}`}>
            <rect x={x} y={y} width={pw} height={ph} rx="1" fill="oklch(0.2 0.005 255)" stroke="var(--metal-line)" strokeWidth="0.6" />
            <circle cx={x + ph / 2 + 1} cy={y + ph / 2} r={ph * 0.36} fill="url(#bb-hex)" />
            <rect x={x + pw - 8} y={y + ph / 2 - 2.5} width="5" height="5" rx="0.8" fill="oklch(0.1 0.004 255)" />
            <circle cx={x + pw - 10.5} cy={y + 2.5} r="1" fill={on ? LED.ok : LED.off} />
          </g>
        );
      })}
    </>
  );
}

export function Back(p: FrontProps) {
  const { model, w, h, name, ports, state } = p, fs = fsz(Math.min(h, 24)) * 0.9;
  const label = name && <text x={8} y={h / 2 + fs * 0.35} fontFamily={MONO} fontSize={fs} fill="oklch(0.7 0.01 255)">{name}</text>;
  const plate = <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill="oklch(0.24 0.006 255)" stroke="var(--metal-line)" />;
  if (model.kind === "patch") return <>{plate}{label}<Jacks w={w} h={h} name={name} ports={ports} offset={PATCH_JACKS} /></>;
  const spots = model.kind === "server" ? nicLayout(model, w, h) : new Map<number, Spot>();
  const vents = model.kind !== "gateway" && <rect x={w * 0.5} y="3" width={Math.max(0, w * 0.5 - 12 - model.psus * 34)} height={h - 6} rx="1" fill="url(#bb-perf)" opacity="0.35" />;
  return (
    <>
      {plate}
      {label}
      {vents}
      {[...spots].map(([i, s]) => {
        const st = ports[i] ?? "off";
        return (
          <g key={i}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="0.6" fill="oklch(0.12 0.004 255)" stroke="var(--metal-3)" strokeWidth="0.5" />
            {st !== "off" && <rect x={s.x + 1.5} y={s.y + 1} width={s.w - 3} height="1.4" fill={LED[st === "fiber" ? "fiber" : st]} />}
          </g>
        );
      })}
      {model.kind === "gateway"
        ? <rect x={w - 20} y={h / 2 - 3} width="8" height="6" rx="1" fill="oklch(0.1 0.004 255)" />
        : <Psus model={model} w={w} h={h} on={state !== "off"} />}
    </>
  );
}
