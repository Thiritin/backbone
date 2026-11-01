import { Unplug } from "lucide-react";
import { useEffect, useRef, type PointerEvent as RPointerEvent } from "react";
import { useSessionState } from "../../session";
import { modelById, type DeviceModel } from "../../../sim/10-catalog/hardware";
import type { Device, End, GameState, Location } from "../../../sim/50-state";
import { connectError, portPeers } from "../../../sim/60-infra/status";
import { connect, disconnect } from "../../../sim/90-actions/hardware";
import { cableColor, LED } from "../../art/fronts";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { CABLE_NAME, devName, portName, speed } from "../hw";

const NODE_W = 190, GAP_X = 150, GAP_Y = 16, PITCH = 17, HEAD = 36, TOP = 40;
const key = (e: End) => `${e.device}:${e.port}`;

interface Node { d: Device; m: DeviceModel; x: number; y: number; h: number; sub: string }
type Spot = { x: number; y: number; left: number; right: number };

// Three columns, so every cable runs between neighbouring columns or loops beside its own: the carrier panel,
// the network (switches, firewalls and patch panels), and the servers grouped by rack.
// Every device lists its ports top to bottom, one row each.
function layout(g: GameState, loc: Location) {
  const racks = g.racks.filter((r) => r.locationId === loc.id).sort((a, b) => a.position - b.position);
  const rackOf = new Map(racks.map((r) => [r.id, r]));
  const devs = g.devices.filter((d) => d.panel === loc.id || (d.rackId && rackOf.has(d.rackId)));
  const kind = (d: Device) => modelById(d.model).kind;
  const net = (d: Device) => !d.panel && kind(d) !== "server";
  const cols: { title: string; groups: { head?: string; ds: Device[] }[] }[] = [
    { title: t("locations-1.carrierPanel"), groups: [{ ds: devs.filter((d) => d.panel) }] },
    { title: t("locations-1.network"), groups: [{ ds: devs.filter(net).sort((a, b) => Number(kind(a) === "patch") - Number(kind(b) === "patch") || b.slot - a.slot) }] },
    { title: t("locations-1.servers"), groups: racks.map((r) => ({ head: r.name, ds: devs.filter((d) => d.rackId === r.id && kind(d) === "server").sort((a, b) => b.slot - a.slot) })) },
  ].map((c) => ({ ...c, groups: c.groups.filter((gr) => gr.ds.length) })).filter((c) => c.groups.length);
  const nodes: Node[] = [], spots = new Map<string, Spot>(), heads: { text: string; x: number; y: number }[] = [];
  cols.forEach((c, ci) => {
    const x = 20 + ci * (NODE_W + GAP_X);
    heads.push({ text: c.title, x, y: TOP - 12 });
    let y = TOP;
    for (const gr of c.groups) {
      if (gr.head && c.groups.length > 1) { heads.push({ text: gr.head, x, y: y + 10 }); y += 18; }
      for (const d of gr.ds) {
        const m = modelById(d.model), rack = d.rackId ? rackOf.get(d.rackId) : undefined;
        m.ports.forEach((_, p) => spots.set(key({ device: d.id, port: p }), { x, y: y + HEAD + p * PITCH + PITCH / 2, left: x, right: x + NODE_W }));
        const h = HEAD + m.ports.length * PITCH + 6;
        nodes.push({ d, m, x, y, h, sub: rack ? `${rack.name} · U${d.slot}` : t("locations-1.carrierPanel") });
        y += h + GAP_Y;
      }
    }
  });
  return { heads, nodes, spots };
}

// A cable leaves each port row on the side facing the other end; both ends in one column loop out to the right.
const ends = (a: Spot, b: Spot): [{ x: number; y: number }, { x: number; y: number }, number] => {
  if (a.left === b.left) return [{ x: a.right, y: a.y }, { x: b.right, y: b.y }, 1];
  return a.left < b.left ? [{ x: a.right, y: a.y }, { x: b.left, y: b.y }, 0] : [{ x: a.left, y: a.y }, { x: b.right, y: b.y }, 0];
};
const skips = (a: Spot, b: Spot) => Math.abs(a.left - b.left) > NODE_W + GAP_X;
const wire = (a: Spot, b: Spot) => {
  const [p, q, loop] = ends(a, b);
  if (loop) { const bx = p.x + 30 + Math.abs(p.y - q.y) * 0.08; return `M${p.x} ${p.y}C${bx} ${p.y} ${bx} ${q.y} ${q.x} ${q.y}`; }
  const dx = Math.max(40, Math.abs(q.x - p.x) / 2) * Math.sign(q.x - p.x);
  return `M${p.x} ${p.y}C${p.x + dx} ${p.y} ${q.x - dx} ${q.y} ${q.x} ${q.y}`;
};
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2) * Math.sign(b.x - a.x || 1);
  return `M${a.x} ${a.y}C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
};

export function Cabling({ game, loc }: { game: GameState; loc: Location }) {
  const act = useStore((s) => s.act);
  const [sel, setSel] = useSessionState<string | null>("cabling.sel", null);
  const svg = useRef<SVGSVGElement>(null), plane = useRef<SVGGElement>(null), line = useRef<SVGPathElement>(null);
  const pan = useRef({ x: 0, y: 0 });
  const drag = useRef<{ mode: "pan" | "cable"; x: number; y: number; from?: End } | null>(null);
  const { heads, nodes, spots } = layout(game, loc);
  const cables = game.cables.filter((c) => spots.has(key(c.a)) && spots.has(key(c.b)));
  const peer = new Map(cables.flatMap((c) => [[key(c.a), c.id], [key(c.b), c.id]]));
  const chosen = cables.find((c) => c.id === sel);
  const wires = (over: boolean) => (
    <g className="loc-cab-wires">
      {cables.filter((c) => skips(spots.get(key(c.a))!, spots.get(key(c.b))!) === over).map((c) => (
        <path key={c.id} data-cable={c.id} className={c.id === sel ? "sel" : ""} stroke={cableColor(c)} d={wire(spots.get(key(c.a))!, spots.get(key(c.b))!)} />
      ))}
    </g>
  );
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
    line.current!.setAttribute("d", curve({ x: b.x < a.left ? a.left : a.right, y: a.y }, b));
  };
  const up = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode !== "cable") return;
    line.current!.setAttribute("d", "");
    ports().forEach((el) => el.classList.remove("dim", "src"));
    const t = portAt(e);
    if (t && t.dataset.p !== key(d.from!)) act(connect, d.from!, endOf(t));
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
          <button className="btn danger" onClick={() => { act(disconnect, chosen.id); setSel(null); }}><Unplug />{t("locations-1.disconnect")}</button>
        </div>
      )}
      <svg ref={svg} className="loc-cab" role="application" aria-label={t("locations-1.cabling")} onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onPointerOver={(e) => hover(e, true)} onPointerOut={(e) => hover(e, false)} onWheel={(e) => { pan.current = { x: pan.current.x - e.deltaX, y: pan.current.y - e.deltaY }; plane.current!.setAttribute("transform", `translate(${pan.current.x} ${pan.current.y})`); }}>
        <g ref={plane}>
          <g className="loc-cab-hits">
            {cables.map((c) => <path key={c.id} data-c={c.id} d={wire(spots.get(key(c.a))!, spots.get(key(c.b))!)} />)}
          </g>
          {/* Cables end at the edge of their port rows. Those between neighbouring columns run under the nodes;
              those that skip a column pass over it, so they never seem to end at the column they cross. */}
          {wires(false)}
          {heads.map((h) => <text key={`${h.text}${h.x}${h.y}`} x={h.x} y={h.y} className="loc-cab-col">{h.text}</text>)}
          {nodes.map((n) => <NodeBox key={n.d.id} n={n} peers={portPeers(game, n.d.id)} cableOf={peer} />)}
          {wires(true)}
          <g className="loc-cab-plugs">
            {cables.flatMap((c) => {
              const [p, q] = ends(spots.get(key(c.a))!, spots.get(key(c.b))!);
              return [p, q].map((e, i) => <circle key={`${c.id}${i}`} cx={e.x} cy={e.y} r="3" fill={cableColor(c)} />);
            })}
          </g>
          <path ref={line} className="loc-cab-drag" />
        </g>
      </svg>
    </div>
  );
}

function NodeBox({ n, peers, cableOf }: { n: Node; peers: (End | null)[]; cableOf: Map<string, string> }) {
  return (
    <g>
      <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx="8" className="loc-cab-node" />
      <text x={n.x + 10} y={n.y + 15} className="loc-cab-name">{devName(n.d)}</text>
      <text x={n.x + 10} y={n.y + 27} className="loc-cab-sub">{n.sub}</text>
      {n.m.ports.map((port, p) => {
        const y = n.y + HEAD + p * PITCH, sfp = port.media === "sfp", k2 = `${n.d.id}:${p}`;
        const lamp = peers[p] ? (sfp ? LED.fiber : LED.ok) : null, jx = n.x + NODE_W - 24;
        return (
          <g key={p} data-p={k2} data-on={cableOf.get(k2)} className="loc-cab-port">
            <rect x={n.x + 2} y={y} width={NODE_W - 4} height={PITCH} rx="3" className="loc-cab-row" />
            <text x={n.x + 10} y={y + PITCH / 2 + 3.5} className="loc-cab-label">{portName(n.m, p)}</text>
            <text x={jx - 8} y={y + PITCH / 2 + 3.5} textAnchor="end" className="loc-cab-speed">{sfp ? "SFP " : port.media === "dsl" ? `${t("art.portDsl")} ` : ""}{speed(port.gbit)}</text>
            <rect x={jx + (port.media === "dsl" ? 2 : 0)} y={y + (sfp ? 3.5 : port.media === "dsl" ? 4.5 : 2.5)} width={sfp ? 13 : port.media === "dsl" ? 8 : 12} height={sfp ? 9 : port.media === "dsl" ? 7 : 11} rx={sfp ? 1 : 2} className={port.media} />
            {lamp && <rect x={jx + 2.5} y={y + (sfp ? 5 : 4)} width={sfp ? 8 : 7} height="2" rx="0.5" fill={lamp} pointerEvents="none" />}
          </g>
        );
      })}
    </g>
  );
}
