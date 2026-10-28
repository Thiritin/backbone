import { Unplug } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { jacksOf, modelById, type DeviceModel } from "../../../sim/10-catalog/hardware";
import type { Device, End, GameState, Location } from "../../../sim/50-state";
import { connectError, portPeers } from "../../../sim/60-infra/status";
import { connect, disconnect } from "../../../sim/90-actions/hardware";
import { cableColor, LED } from "../../art/fronts";
import { useStore } from "../../store";
import { CABLE_NAME, devName, portName, speed } from "../hw";

const NODE_W = 260, GAP_X = 120, GAP_Y = 14, PITCH = 16, PER_ROW = 12, LABEL_W = 34, HEAD = 34, TOP = 40;
const key = (e: End) => `${e.device}:${e.port}`;

interface Run { label: string; ports: number[] }
interface Node { d: Device; m: DeviceModel; x: number; y: number; h: number; sub: string; runs: { run: Run; rows: number }[] }

// Runs of ports with the same media and speed; patch panels split into front and back jacks.
function runs(m: DeviceModel): Run[] {
  if (m.kind === "patch") { const n = jacksOf(m); return [{ label: "Front", ports: Array.from({ length: n }, (_, i) => i) }, { label: "Back", ports: Array.from({ length: n }, (_, i) => n + i) }]; }
  const out: Run[] = [];
  m.ports.forEach((p, i) => {
    const label = `${p.media === "sfp" ? "SFP " : ""}${speed(p.gbit)}`, last = out.at(-1);
    if (last?.label === label) last.ports.push(i); else out.push({ label, ports: [i] });
  });
  return out;
}

// Columns left to right: carrier panel, switches and firewalls, patch panels, then the servers of each rack.
function layout(g: GameState, loc: Location) {
  const racks = g.racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position);
  const rackOf = new Map(racks.map((r) => [r.id, r]));
  const devs = g.devices.filter((d) => d.panel === loc.id || (d.rackId && rackOf.has(d.rackId)));
  const kind = (d: Device) => modelById(d.model).kind;
  const cols: { title: string; ds: Device[] }[] = [
    { title: "Carrier panel", ds: devs.filter((d) => d.panel) },
    { title: "Network", ds: devs.filter((d) => !d.panel && ["switch", "firewall", "gateway"].includes(kind(d))) },
    { title: "Patch panels", ds: devs.filter((d) => kind(d) === "patch") },
    ...racks.map((r) => ({ title: r.name, ds: devs.filter((d) => d.rackId === r.id && kind(d) === "server") })),
  ].filter((c) => c.ds.length);
  const nodes: Node[] = [], spots = new Map<string, { x: number; y: number }>();
  cols.forEach((c, ci) => {
    let y = TOP;
    const x = 20 + ci * (NODE_W + GAP_X);
    for (const d of [...c.ds].sort((a, b) => b.slot - a.slot)) {
      const m = modelById(d.model), rs = runs(m).map((run) => ({ run, rows: Math.ceil(run.ports.length / PER_ROW) }));
      const rack = d.rackId ? rackOf.get(d.rackId) : undefined;
      let py = y + HEAD;
      for (const { run } of rs) {
        run.ports.forEach((p, k) => spots.set(key({ device: d.id, port: p }), { x: x + LABEL_W + (k % PER_ROW) * PITCH + 6, y: py + Math.floor(k / PER_ROW) * PITCH + 6 }));
        py += Math.ceil(run.ports.length / PER_ROW) * PITCH + 4;
      }
      const h = py - y + 6;
      nodes.push({ d, m, x, y, h, sub: rack ? `${rack.name} · U${d.slot}` : "Carrier panel", runs: rs });
      y += h + GAP_Y;
    }
  });
  return { cols: cols.map((c, i) => ({ title: c.title, x: 20 + i * (NODE_W + GAP_X) })), nodes, spots };
}

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  if (Math.abs(a.x - b.x) < NODE_W) { const bx = Math.max(a.x, b.x) + 60; return `M${a.x} ${a.y}C${bx} ${a.y} ${bx} ${b.y} ${b.x} ${b.y}`; }
  const dx = Math.max(50, Math.abs(b.x - a.x) / 2) * Math.sign(b.x - a.x);
  return `M${a.x} ${a.y}C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
};

export function Cabling({ game, loc }: { game: GameState; loc: Location }) {
  const act = useStore((s) => s.act);
  const [sel, setSel] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null), plane = useRef<SVGGElement>(null), line = useRef<SVGPathElement>(null);
  const pan = useRef({ x: 0, y: 0 });
  const drag = useRef<{ mode: "pan" | "cable"; x: number; y: number; from?: End } | null>(null);
  const { cols, nodes, spots } = layout(game, loc);
  const cables = game.cables.filter((c) => spots.has(key(c.a)) && spots.has(key(c.b)));
  const peer = new Map(cables.flatMap((c) => [[key(c.a), c.id], [key(c.b), c.id]]));
  const chosen = cables.find((c) => c.id === sel);
  const name = (e: End) => { const d = game.devices.find((x) => x.id === e.device)!; return `${devName(d)} ${portName(modelById(d.model), e.port)}`; };

  useEffect(() => { plane.current?.setAttribute("transform", `translate(${pan.current.x} ${pan.current.y})`); });

  const point = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - pan.current.x, y: e.clientY - r.top - pan.current.y };
  };
  const ports = () => svg.current!.querySelectorAll<SVGElement>("[data-p]");
  const portAt = (e: { clientX: number; clientY: number }) => (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest<SVGElement>("[data-p]");
  const endOf = (el: SVGElement): End => { const [device, port] = el.dataset.p!.split(":"); return { device, port: Number(port) }; };

  const down = (e: RPointerEvent<SVGSVGElement>) => {
    const t = (e.target as Element).closest<SVGElement>("[data-p], [data-c]");
    if (t?.dataset.c) { setSel(t.dataset.c); return; }
    svg.current!.setPointerCapture(e.pointerId);
    if (!t) { drag.current = { mode: "pan", x: e.clientX - pan.current.x, y: e.clientY - pan.current.y }; return; }
    const from = endOf(t);
    if (peer.has(key(from))) { setSel(peer.get(key(from))!); drag.current = null; return; }
    // Ports that can't take this cable fade for the length of the drag.
    const s = useStore.getState().game;
    ports().forEach((el) => { if (el !== t && connectError(s, from, endOf(el))) el.classList.add("dim"); });
    t.classList.add("src");
    drag.current = { mode: "cable", x: 0, y: 0, from };
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") {
      pan.current = { x: e.clientX - d.x, y: e.clientY - d.y };
      plane.current!.setAttribute("transform", `translate(${pan.current.x} ${pan.current.y})`);
      return;
    }
    const a = spots.get(key(d.from!))!, b = point(e);
    line.current!.setAttribute("d", curve(a, b));
  };
  const up = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode !== "cable") return;
    line.current!.setAttribute("d", "");
    ports().forEach((el) => el.classList.remove("dim", "src"));
    const t = portAt(e);
    if (t && t.dataset.p !== key(d.from!)) act((s) => connect(s, d.from!, endOf(t)));
  };
  const hover = (e: RPointerEvent<SVGSVGElement>, on: boolean) => {
    const t = (e.target as Element).closest<SVGElement>("[data-p]");
    const c = t && peer.get(t.dataset.p!);
    if (!c) return;
    svg.current!.querySelectorAll(`[data-cable="${c}"], [data-on~="${c}"]`).forEach((el) => el.classList.toggle("hot", on));
  };

  return (
    <div className="loc-cabling">
      {chosen && (
        <div className="loc-cab-bar">
          <span className="num">{name(chosen.a)}</span>
          <span className={`loc-cab-kind ${chosen.kind}`}>{CABLE_NAME[chosen.kind]}</span>
          <span className="num">{name(chosen.b)}</span>
          <button className="btn danger" onClick={() => { act((s) => disconnect(s, chosen.id)); setSel(null); }}><Unplug />Disconnect</button>
        </div>
      )}
      <svg ref={svg} className="loc-cab" role="application" aria-label="Cabling" onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onPointerOver={(e) => hover(e, true)} onPointerOut={(e) => hover(e, false)} onWheel={(e) => { pan.current = { x: pan.current.x - e.deltaX, y: pan.current.y - e.deltaY }; plane.current!.setAttribute("transform", `translate(${pan.current.x} ${pan.current.y})`); }}>
        <g ref={plane}>
          <g className="loc-cab-hits">
            {cables.map((c) => <path key={c.id} data-c={c.id} d={curve(spots.get(key(c.a))!, spots.get(key(c.b))!)} />)}
          </g>
          {/* Cables run under the nodes, so they show between columns and never cover a jack. */}
          <g className="loc-cab-wires">
            {cables.map((c) => <path key={c.id} data-cable={c.id} className={c.id === sel ? "sel" : ""} stroke={cableColor(c)} d={curve(spots.get(key(c.a))!, spots.get(key(c.b))!)} />)}
          </g>
          {cols.map((c) => <text key={c.title + c.x} x={c.x} y={TOP - 12} className="loc-cab-col">{c.title}</text>)}
          {nodes.map((n) => <NodeBox key={n.d.id} n={n} peers={portPeers(game, n.d.id)} cableOf={peer} />)}
          <path ref={line} className="loc-cab-drag" />
        </g>
      </svg>
    </div>
  );
}

function NodeBox({ n, peers, cableOf }: { n: Node; peers: (End | null)[]; cableOf: Map<string, string> }) {
  let py = n.y + HEAD;
  const rows: ReactNode[] = [];
  for (const { run, rows: r } of n.runs) {
    rows.push(<text key={`l${py}`} x={n.x + 8} y={py + 8} className="loc-cab-speed">{run.label}</text>);
    run.ports.forEach((p, k) => {
      const x = n.x + LABEL_W + (k % PER_ROW) * PITCH, y = py + Math.floor(k / PER_ROW) * PITCH, sfp = n.m.ports[p].media === "sfp";
      const k2 = `${n.d.id}:${p}`, lamp = peers[p] ? (sfp ? LED.fiber : LED.ok) : null;
      rows.push(
        <g key={p} data-p={k2} data-on={cableOf.get(k2)} className="loc-cab-port">
          <title>{portName(n.m, p)}</title>
          <rect x={x} y={y + (sfp ? 1.5 : 0)} width={sfp ? 13 : 12} height={sfp ? 9 : 12} rx={sfp ? 1 : 2} className={sfp ? "sfp" : "rj45"} />
          {lamp && <rect x={x + 2.5} y={y + (sfp ? 3 : 2)} width={sfp ? 8 : 7} height="2" rx="0.5" fill={lamp} pointerEvents="none" />}
        </g>,
      );
    });
    py += r * PITCH + 4;
  }
  return (
    <g>
      <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx="8" className="loc-cab-node" />
      <text x={n.x + 10} y={n.y + 15} className="loc-cab-name">{devName(n.d)}</text>
      <text x={n.x + 10} y={n.y + 27} className="loc-cab-sub">{n.sub}</text>
      {rows}
    </g>
  );
}
