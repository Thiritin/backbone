// Management ports and management devices: a server's console end, a switch or router's MGMT and CONSOLE jacks, and the
// KVMs, console servers and OOB switch, whose every port is on the back.
import { OOB_PORT, oobPorts, type DeviceModel, type OobPort } from "../../sim/10-catalog/hardware";
import type { Spot } from "./backs";
import { AssetTag, fsz, LED, numBand, numSize, switchX0, type FrontProps } from "./fronts";

const MONO = "JetBrains Mono, monospace", NUM = "oklch(0.74 0.01 255)";
export const isMgmtModel = (m: DeviceModel): boolean => m.kind === "kvm" || m.kind === "console" || m.kind === "oob";

// The label printed at a management port: KVM outputs and serial ports count from 1.
export function oobLabel(m: DeviceModel, port: number): string {
  const kinds = oobPorts(m), i = port - OOB_PORT, kind = kinds[i];
  if (kind === "kvm" || kind === "serial") return String(kinds.slice(0, i + 1).filter((k) => k === kind).length);
  return kind === "console" ? (m.kind === "server" ? "VGA" : "CON") : kind === "mgmt" ? "MGMT" : "NET";
}

// Where the management ports sit on the back, keyed by port number.
export function oobSpots(model: DeviceModel, name: string, w: number, h: number): Map<number, Spot> {
  const kinds = oobPorts(model), out = new Map<number, Spot>();
  const at = (kind: OobPort, s: Spot) => out.set(OOB_PORT + kinds.indexOf(kind), s);
  if (!kinds.length) return out;
  if (model.kind === "server") {
    const u = h / model.height, ph = Math.min(u - 2 * numBand(u), 10);
    at("console", { x: w * 0.7 + 6, y: h - u + (u - ph) / 2, w: 15, h: ph });
  } else if (model.kind === "switch") {
    const x0 = switchX0(model, name, h), s = Math.min(10, h * 0.42);
    at("console", { x: x0, y: h / 2 - s * 0.85, w: s * 0.9, h: s * 0.8 });
    at("mgmt", { x: x0, y: h / 2 + s * 0.05, w: s * 0.9, h: s * 0.8 });
  } else if (model.kind === "gateway") {
    const ph = Math.min(9, h * 0.36);
    at("console", { x: 12, y: h / 2 - ph / 2, w: 9, h: ph });
    at("mgmt", { x: 24, y: h / 2 - ph / 2, w: 9, h: ph });
  } else {
    const n = kinds.length, rows = n > 26 ? 2 : 1, per = Math.ceil(n / rows), x0 = 16, step = Math.min(13, (w * 0.72 - x0) / per);
    const band = numBand(h), ph = Math.min(9, rows === 2 ? (h - 2 * band - 3) / 2 : h - 2 * band - 2);
    kinds.forEach((_, i) => {
      const row = Math.floor(i / per), y = rows === 2 ? band + 0.5 + row * (ph + 2) : (h - ph) / 2;
      out.set(OOB_PORT + i, { x: x0 + (i % per) * step, y, w: step - 2.5, h: ph });
    });
  }
  return out;
}

const FILL: Record<OobPort, string> = {
  console: "oklch(0.5 0.09 230)", serial: "oklch(0.5 0.09 230)", mgmt: "oklch(0.12 0.004 255)", net: "oklch(0.12 0.004 255)", kvm: "oklch(0.16 0.008 255)",
};

// The management jacks of a device, with their printed labels; the bottom row of a two-row panel is labelled below.
export function OobJacks({ model, name, w, h }: { model: DeviceModel; name: string; w: number; h: number }) {
  const kinds = oobPorts(model), spots = oobSpots(model, name, w, h), fs = numSize(Math.min(h, 40));
  const below = (s: Spot) => s.y > h / 2;
  return (
    <g aria-label="Management ports">
      {[...spots].map(([port, s]) => {
        const kind = kinds[port - OOB_PORT], vga = kind === "console" && model.kind === "server";
        return (
          <g key={port}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={vga ? s.h * 0.3 : 0.6} fill={vga ? "oklch(0.45 0.12 262)" : FILL[kind]} stroke="var(--metal-3)" strokeWidth="0.5" />
            {kind === "kvm" && <rect x={s.x + s.w * 0.2} y={s.y + s.h * 0.35} width={s.w * 0.6} height={s.h * 0.3} rx="0.4" fill="oklch(0.4 0.01 255)" />}
            <text x={s.x + s.w / 2} y={below(s) && isMgmtModel(model) ? s.y + s.h + fs * 0.75 + 0.4 : s.y - 0.6} fontFamily={MONO} fontSize={fs} fill={NUM} textAnchor="middle" aria-hidden="true">
              {oobLabel(model, port)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const BODY: Record<string, string> = { kvm: "oklch(0.2 0.005 255)", console: "oklch(0.25 0.012 50)", oob: "oklch(0.3 0.008 255)" };

// A PiKVN is a bare board in a small case; the others are 1U boxes with a power light and the model printed on the bezel.
export function MgmtFront({ model, w, h, name, state }: FrontProps) {
  const fs = fsz(Math.min(h, 24)), board = model.height === 0;
  return (
    <>
      {board
        ? <rect x="2" y={h * 0.2} width={w * 0.34} height={h * 0.6} rx="2" fill="oklch(0.42 0.1 150)" stroke="oklch(0.3 0.05 150)" />
        : <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill={BODY[model.kind]} stroke="var(--metal-line)" />}
      <circle cx={12} cy={h / 2} r="1.6" fill={LED[state]} />
      <text x={20} y={h / 2 + fs * 0.35} fontFamily={MONO} fontSize={fs} fill="oklch(0.86 0.01 255)">{model.name}</text>
      <AssetTag x={w - 8} y={h / 2} text={name} h={h} anchor="end" />
    </>
  );
}

export function MgmtBack({ model, w, h, name }: FrontProps) {
  const board = model.height === 0;
  return (
    <>
      {board
        ? <rect x="2" y={h * 0.12} width={w * 0.34} height={h * 0.76} rx="2" fill="oklch(0.42 0.1 150)" stroke="oklch(0.3 0.05 150)" />
        : <rect x="0" y="0.5" width={w} height={h - 1} rx="1.5" fill={BODY[model.kind]} stroke="var(--metal-line)" />}
      <OobJacks model={model} name={name} w={w} h={h} />
      <AssetTag x={w - 8} y={h / 2} text={name} h={h} anchor="end" />
    </>
  );
}
