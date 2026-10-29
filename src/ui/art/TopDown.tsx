// A server chassis seen from above with its front on the left. The lid slides off to the right and every slot is a button.
import type { KeyboardEvent, ReactNode } from "react";
import { bayCount, FAN_SLOTS, type ComponentKind, type DeviceModel, type FormFactor } from "../../sim/10-catalog/hardware";
import type { Component } from "../../sim/50-state";
import { disk, partSize } from "../apps/hw";
import { AssetTag, Defs, LED, lineOf } from "./fronts";
import { BrandMark } from "./logos";

export type Group = "cpu" | "ram" | "bay" | "pcie" | "psu" | "fan" | "board";
export type Wear = "ok" | "warn" | "bad";
export interface Slot { id: string; group: Group; index: number; ff?: FormFactor; part?: Component }

// The parts each group of slots holds; PCIe slots show the network card.
export const GROUP_KINDS: Record<Group, ComponentKind[]> = {
  cpu: ["cpu"], ram: ["ram"], bay: ["hdd", "ssd", "nvme"], pcie: ["nic"], psu: ["psu"], fan: ["fan"], board: ["board"],
};
export const GROUP_NAME: Record<Group, string> = { cpu: "CPU sockets", ram: "DIMM slots", bay: "Drive bays", pcie: "PCIe slots", psu: "Power supply bays", fan: "Fans", board: "Mainboard" };

// Every slot of a chassis in group order; the first slots of a group hold its parts.
export function chassisSlots(model: DeviceModel, parts: Component[]): Slot[] {
  const v = model.server!;
  const count: Record<Group, number> = { cpu: v.sockets, ram: v.dimmSlots, bay: bayCount(v), pcie: v.pcie, psu: v.psuBays, fan: FAN_SLOTS, board: 1 };
  const ffs = v.bays.flatMap((b) => Array<FormFactor>(b.count).fill(b.ff));
  return (Object.keys(count) as Group[]).flatMap((group) => {
    const held = parts.filter((c) => GROUP_KINDS[group].includes(c.kind));
    return Array.from({ length: count[group] }, (_, index): Slot => ({ id: `${group}${index}`, group, index, ...(group === "bay" ? { ff: ffs[index] } : {}), ...(held[index] ? { part: held[index] } : {}) }));
  });
}

interface R { x: number; y: number; w: number; h: number }
const box = (r: R) => ({ x: r.x, y: r.y, width: r.w, height: r.h });
const L = 832, W = 344, X0 = 24, Y0 = 30;
export const VIEW = { w: 880, h: 414 };

// Where each zone and slot sits inside the chassis, by line: bays at the front, then the fan wall, the board with a band per
// socket, and the power supplies and PCIe slots at the rear. Storage lines grow their bay grid, the GPU line its rear row.
function layout(model: DeviceModel, slots: Slot[]) {
  const v = model.server!, gpu = lineOf(model) === "gpu";
  const at: Record<string, R> = {};
  const bays = slots.filter((s) => s.group === "bay").length;
  const rows = bays <= 10 ? bays : bays <= 12 ? 6 : 12, cols = Math.ceil(bays / rows);
  const len = v.bays[0].ff === "3.5" ? 52 : 44;
  const bayLen = cols * (len + 4) + 14, fanLen = [0, 22, 30, 34, 38][model.height] ?? 38, rearLen = gpu ? 230 : 130;
  const boardX = bayLen + fanLen, boardLen = L - boardX - rearLen;
  const cellH = Math.min(80, (W - 24 - (rows - 1) * 3) / rows), top = (W - (rows * cellH + (rows - 1) * 3)) / 2;
  slots.filter((s) => s.group === "bay").forEach((s) => { at[s.id] = { x: 8 + Math.floor(s.index / rows) * (len + 4), y: top + (s.index % rows) * (cellH + 3), w: len, h: cellH }; });
  const fanH = (W - 24 - 3 * 6) / 4;
  slots.filter((s) => s.group === "fan").forEach((s) => { at[s.id] = { x: bayLen + 2, y: 12 + s.index * (fanH + 6), w: fanLen - 6, h: fanH }; });

  const board: R = { x: boardX + 4, y: 10, w: boardLen - 8, h: W - 20 };
  at.board0 = board;
  const n = v.sockets, band = (board.h - 16 - (n - 1) * 10) / n, cpu = Math.min(band - 16, 88);
  const ramSlots = slots.filter((s) => s.group === "ram");
  for (let j = 0; j < n; j++) {
    const y = board.y + 8 + j * (band + 10);
    at[`cpu${j}`] = { x: board.x + 14, y: y + (band - cpu) / 2, w: cpu, h: cpu };
    // Sticks fill the sockets in turn, so a half-filled board has both banks half full.
    const mine = ramSlots.filter((s) => s.index % n === j), sub = band > 220 ? 2 : 1, per = Math.ceil(mine.length / sub);
    const x0 = board.x + 14 + cpu + 22, room = board.x + board.w - 12 - x0;
    const pitch = Math.min(20, (room - Math.floor(per / 2) * 4) / per), h = sub === 1 ? band - 20 : (band - 30) / 2;
    mine.forEach((s, k) => {
      const row = Math.floor(k / per), pos = k % per;
      at[s.id] = { x: x0 + pos * pitch + Math.floor(pos / 2) * 4, y: y + (sub === 1 ? 10 : 10 + row * (h + 10)), w: pitch - 3, h };
    });
  }

  const px = L - Math.min(rearLen - 16, 110) - 6, psuW = L - px - 6;
  slots.filter((s) => s.group === "psu").forEach((s) => { at[s.id] = { x: px, y: 10 + s.index * 56, w: psuW, h: 50 }; });
  const pcieTop = 10 + 2 * 56 + 8, pcie = slots.filter((s) => s.group === "pcie"), ph = Math.min(44, (W - 10 - pcieTop - (pcie.length - 1) * 4) / pcie.length);
  pcie.forEach((s) => { at[s.id] = { x: L - rearLen + 8, y: W - 10 - (pcie.length - s.index) * (ph + 4) + 4, w: rearLen - 16, h: ph }; });
  return { at, bayLen, fanLen, boardX, boardLen, rearLen, board };
}

const PCB = "oklch(0.36 0.07 155)", TRACE = "oklch(0.5 0.08 155)", GOLD = "oklch(0.78 0.13 85)", CHIP = "oklch(0.16 0.005 255)";
const CAVITY = "oklch(0.14 0.008 255)", CAVITY_LINE = "oklch(0.42 0.01 255)", ALU = "oklch(0.74 0.008 255)", INK = "oklch(0.2 0.01 255)";
const MONO = "JetBrains Mono, monospace";

interface Props {
  model: DeviceModel;
  brand: string;
  name: string;
  parts: Component[];
  wear: (c: Component) => Wear;
  open: boolean;
  ms: number;
  sel: string | null;
  onPick: (id: string | null) => void;
}

export function TopDown({ model, brand, name, parts, wear, open, ms, sel, onPick }: Props) {
  const slots = chassisSlots(model, parts), { at, bayLen, boardX, rearLen, board } = layout(model, slots);
  const tall = model.height >= 2, gpu = lineOf(model) === "gpu";
  const boardPart = slots.find((s) => s.group === "board")?.part, boardWear = boardPart ? wear(boardPart) : "ok";
  const caps: [number, string][] = [[0, "Drive bays"], [boardX + 6, "CPUs and memory"], [L - rearLen + 6, gpu ? "GPU slots and power" : "PCIe slots and power"]];

  const slot = (s: Slot, label: string, body: ReactNode, pad = 2) => {
    const r = at[s.id], w = s.part ? wear(s.part) : null;
    const pick = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(sel === s.id ? null : s.id); } };
    return (
      <g key={s.id} className="lid-slot" role="button" tabIndex={open ? 0 : -1} aria-label={label} aria-pressed={sel === s.id}
        onClick={(e) => { e.stopPropagation(); onPick(sel === s.id ? null : s.id); }} onKeyDown={pick}>
        <title>{label}</title>
        {body}
        {w && <circle cx={r.x + r.w - 4} cy={r.y + 4} r="2.2" fill={LED[w]} stroke="oklch(0.1 0.004 255)" strokeWidth="0.5" />}
        <rect className="lid-ring" x={r.x - pad - 1} y={r.y - pad - 1} width={r.w + 2 * pad + 2} height={r.h + 2 * pad + 2} rx="3" />
        <rect className="lid-ring-in" x={r.x - pad + 0.5} y={r.y - pad + 0.5} width={r.w + 2 * pad - 1} height={r.h + 2 * pad - 1} rx="2" />
      </g>
    );
  };
  const stroke = (s: Slot) => {
    const w = s.part ? wear(s.part) : "ok";
    return w === "ok" ? { stroke: s.part ? "oklch(0.1 0.004 255)" : CAVITY_LINE, strokeDasharray: s.part ? undefined : "3 2" } : { stroke: LED[w], strokeWidth: 1.6 };
  };
  const label = (s: Slot, noun: string) => `${noun} ${s.index + 1}, ${s.part ? partSize(s.part) === "-" ? "filled" : partSize(s.part) : "empty"}`;

  return (
    <svg className="lid-view" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="group" aria-label={`${model.name}, top view`} onClick={() => onPick(null)}>
      <Defs />
      <defs>
        <pattern id="lid-pins" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill={CAVITY} /><circle cx="2" cy="2" r="0.9" fill={GOLD} opacity="0.7" /></pattern>
        <pattern id="lid-fins" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill={ALU} /><rect width="1.6" height="4" fill="oklch(0.55 0.01 255)" /></pattern>
      </defs>
      {caps.map(([x, t]) => <text key={t} className="lid-cap" x={X0 + x} y={Y0 - 10}>{t}</text>)}
      <text className="lid-cap dim" x={X0} y={Y0 + W + 20}>Front</text>
      <text className="lid-cap dim" x={X0 + L} y={Y0 + W + 20} textAnchor="end">Rear</text>

      <g transform={`translate(${X0} ${Y0})`}>
        <rect x="0" y="0" width={L} height={W} rx="6" className="lid-tub" />
        <rect x="3" y="3" width={L - 6} height={W - 6} rx="4" fill="var(--metal)" />
        <line x1={bayLen} x2={bayLen} y1="3" y2={W - 3} stroke="var(--metal-line)" />
        <line x1={L - rearLen} x2={L - rearLen} y1="3" y2={W - 3} stroke="var(--metal-line)" />

        {slots.filter((s) => s.group === "bay").map((s) => {
          const r = at[s.id], c = s.part, nv = c?.kind === "nvme", dim = c ? (nv ? "oklch(0.34 0.07 262)" : c.kind === "ssd" ? "oklch(0.5 0.04 255)" : ALU) : CAVITY;
          return slot(s, label(s, "Bay"), (
            <>
              <rect {...box(r)} rx="1.5" fill={dim} {...stroke(s)} />
              {c && <rect x={r.x + 3} y={r.y + r.h / 2 - 4} width={r.w - 14} height="8" rx="1" fill={nv ? CHIP : "oklch(0.93 0.005 255)"} />}
              {c && r.h >= 14 && <text x={r.x + 3 + (r.w - 14) / 2} y={r.y + r.h / 2 + 2.6} textAnchor="middle" fontFamily={MONO} fontSize="6.4" fill={nv ? "oklch(0.9 0.01 255)" : INK}>{disk(c.size ?? 0)}</text>}
            </>
          ));
        })}

        {slots.filter((s) => s.group === "fan").map((s) => {
          const r = at[s.id];
          return slot(s, label(s, "Fan"), (
            <>
              <rect {...box(r)} rx="2" fill={s.part ? "oklch(0.22 0.006 255)" : CAVITY} {...stroke(s)} />
              {s.part && Array.from({ length: 6 }, (_, i) => <line key={i} x1={r.x + 3} x2={r.x + r.w - 3} y1={r.y + 8 + i * ((r.h - 16) / 5)} y2={r.y + 8 + i * ((r.h - 16) / 5)} stroke="oklch(0.42 0.008 255)" strokeWidth="1.4" />)}
            </>
          ));
        })}

        <g className="lid-slot board" role="button" tabIndex={open ? 0 : -1} aria-label="Mainboard" aria-pressed={sel === "board0"}
          onClick={(e) => { e.stopPropagation(); onPick(sel === "board0" ? null : "board0"); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(sel === "board0" ? null : "board0"); } }}>
          <title>Mainboard</title>
          <rect {...box(board)} rx="3" fill={PCB} stroke={boardWear === "ok" ? TRACE : LED[boardWear]} strokeWidth="1.4" />
          {Array.from({ length: model.server!.sockets }, (_, j) => (
            <g key={j} stroke={TRACE} strokeWidth="1" opacity="0.7">
              {[0, 1, 2].map((k) => <line key={k} x1={at[`cpu${j}`].x + at[`cpu${j}`].w} x2={at[`cpu${j}`].x + at[`cpu${j}`].w + 22} y1={at[`cpu${j}`].y + 22 + k * 22} y2={at[`cpu${j}`].y + 22 + k * 22} />)}
            </g>
          ))}
          <rect x={at.cpu0.x + at.cpu0.w / 2 - 16} y={model.server!.sockets === 2 ? board.y + board.h / 2 - 16 : at.cpu0.y + at.cpu0.h + 30} width="32" height="32" rx="2" fill={CHIP} stroke={TRACE} />
          <rect className="lid-ring" x={board.x - 2} y={board.y - 2} width={board.w + 4} height={board.h + 4} rx="4" />
          <rect className="lid-ring-in" x={board.x} y={board.y} width={board.w} height={board.h} rx="3" />
        </g>

        {slots.filter((s) => s.group === "cpu").map((s) => {
          const r = at[s.id];
          return slot(s, label(s, "CPU socket"), (
            <>
              {tall && <rect x={r.x + 3} y={r.y + 3} width={r.w} height={r.h} rx="2" fill="oklch(0.1 0.004 255)" opacity="0.5" />}
              <rect {...box(r)} rx="2" fill="url(#lid-pins)" {...stroke(s)} />
              {s.part && (
                <>
                  <rect x={r.x + 4} y={r.y + 4} width={r.w - 8} height={r.h - 8} rx="1.5" fill="url(#lid-fins)" stroke="oklch(0.3 0.01 255)" strokeWidth="0.8" />
                  {tall && <><rect x={r.x + 4} y={r.y + r.h / 2 - 5} width={r.w - 8} height="10" fill="oklch(0.82 0.008 255)" /></>}
                  <rect x={r.x + r.w / 2 - 22} y={r.y + r.h / 2 - 7} width="44" height="14" rx="2" fill="oklch(0.95 0.005 255)" stroke="oklch(0.3 0.01 255)" strokeWidth="0.6" />
                  <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 2.8} textAnchor="middle" fontFamily={MONO} fontSize="7.6" fontWeight="600" fill={INK}>{partSize(s.part)}</text>
                </>
              )}
            </>
          ), 4);
        })}

        {slots.filter((s) => s.group === "ram").map((s) => {
          const r = at[s.id], c = s.part, chips = Math.max(3, Math.floor(r.h / 22));
          return slot(s, label(s, "DIMM"), (
            <>
              <rect {...box(r)} rx="1" fill={c ? "oklch(0.3 0.03 255)" : CAVITY} {...stroke(s)} />
              {c && Array.from({ length: chips }, (_, i) => <rect key={i} x={r.x + 1.5} y={r.y + 8 + i * ((r.h - 22) / (chips - 1))} width={Math.max(2, r.w - 3)} height="10" fill={CHIP} />)}
              {c && <rect x={r.x} y={r.y + r.h - 3} width={r.w} height="3" fill={GOLD} />}
              {!c && <><rect x={r.x - 0.5} y={r.y - 1} width={r.w + 1} height="3" fill={CAVITY_LINE} /><rect x={r.x - 0.5} y={r.y + r.h - 2} width={r.w + 1} height="3" fill={CAVITY_LINE} /></>}
            </>
          ), 1.5);
        })}

        {slots.filter((s) => s.group === "psu").map((s) => {
          const r = at[s.id];
          return slot(s, label(s, "Power supply bay"), (
            <>
              <rect {...box(r)} rx="2" fill={s.part ? "url(#bb-perf)" : CAVITY} {...stroke(s)} />
              {s.part && <><circle cx={r.x + 24} cy={r.y + r.h / 2} r="16" fill="url(#bb-hex)" stroke="oklch(0.1 0.004 255)" /><rect x={r.x + r.w - 30} y={r.y + r.h / 2 - 8} width="18" height="16" rx="1.5" fill={INK} /></>}
            </>
          ));
        })}

        {slots.filter((s) => s.group === "pcie").map((s) => {
          const r = at[s.id], c = s.part;
          return slot(s, label(s, gpu ? "GPU slot" : "PCIe slot"), (
            <>
              <rect {...box(r)} rx="2" fill={c ? PCB : CAVITY} {...stroke(s)} />
              {!c && <rect x={r.x + 8} y={r.y + r.h / 2 - 2} width={r.w * 0.45} height="4" fill={CAVITY_LINE} />}
              {c && <><rect x={r.x + r.w - 6} y={r.y} width="6" height={r.h} fill={ALU} /><rect x={r.x + 8} y={r.y + 5} width="22" height={Math.max(4, r.h - 10)} rx="1" fill={CHIP} /><text x={r.x + 38} y={r.y + r.h / 2 + 3} fontFamily={MONO} fontSize="8" fill="oklch(0.92 0.01 255)">NIC</text></>}
            </>
          ), 2);
        })}

        <g className="lid" style={{ transform: open ? `translateX(${L + X0 + 40}px)` : "none", transition: `transform ${ms}ms cubic-bezier(0.4, 0, 0.2, 1)` }}>
          <rect x="6" y="8" width={L} height={W} rx="6" fill="oklch(0 0 0)" opacity="0.28" />
          <rect x="0" y="0" width={L} height={W} rx="6" fill="var(--metal-3)" stroke="var(--metal-line)" strokeWidth="1.2" />
          <rect x="14" y="14" width={L - 28} height={W - 28} rx="3" fill="none" stroke="var(--metal-line)" strokeWidth="0.8" opacity="0.7" />
          <rect x={L * 0.34} y="34" width={L * 0.4} height={W - 68} rx="3" fill="url(#bb-hex)" stroke="var(--metal-line)" />
          <rect x="0" y={W / 2 - 14} width="10" height="28" rx="2" fill="var(--metal-line)" />
          <rect x={L - 10} y={W / 2 - 14} width="10" height="28" rx="2" fill="var(--metal-line)" />
          {[[24, 24], [L - 24, 24], [24, W - 24], [L - 24, W - 24]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="var(--metal)" stroke="var(--metal-line)" />)}
          <AssetTag x={44} y={W - 24} text={name} h={24} />
          {model.kind === "server" && <BrandMark brand={brand} x={L * 0.12} y={W / 2 - 14} size={28} />}
        </g>
      </g>
    </svg>
  );
}
