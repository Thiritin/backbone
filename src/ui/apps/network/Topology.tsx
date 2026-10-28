import { useState } from "react";
import { carrierById, DC_BANDWIDTH, exchangeById } from "../../../sim/10-catalog/network";
import { homeLineById } from "../../../sim/20-world/datacenters";
import { modelById } from "../../../sim/10-catalog/hardware";
import type { GameState, Location } from "../../../sim/50-state";
import { workloadsOn } from "../../../sim/60-infra/cluster";
import { capacityMbps, serviceMbps, type Routing } from "../../../sim/60-infra/network";
import { farEnd, locationOf } from "../../../sim/60-infra/status";
import { loadClass, mbps } from "./NetworkApp";

interface Node { id: string; col: number; label: string; sub: string; expand?: string }
interface Edge { from: string; to: string; load: number; speed: string }

const COLS = ["Carriers and exchanges", "Uplinks", "Routers", "Switches", "Servers"];
const COLLAPSE = 6;
const W = 136, H = 34, GAP_X = 72, GAP_Y = 10;

// Carriers and exchanges, uplinks, routers, switches and servers from left to right, lines coloured by load.
export function Topology({ game, loc, routing }: { game: GameState; loc: Location; routing: Routing }) {
  const [open, setOpen] = useState<string[]>([]);
  const used = routing.zones[loc.id]?.exits ?? {};
  const nodes: Node[] = [], edges: Edge[] = [];
  const add = (n: Node) => { if (!nodes.some((x) => x.id === n.id)) nodes.push(n); };
  const devices = game.devices.filter((d) => locationOf(game, d)?.id === loc.id);
  const name = (id: string) => { const d = game.devices.find((x) => x.id === id)!; return d.label ?? d.name; };
  const kind = (id: string) => modelById(game.devices.find((x) => x.id === id)!.model).kind;
  const routers = devices.filter((d) => kind(d.id) === "gateway");
  const panel = routers.find((d) => d.panel === loc.id);

  // The panel gateway carries the home line or the datacenter's bandwidth.
  if (panel) {
    const cap = loc.dc ? DC_BANDWIDTH.mbps : homeLineById(game.homeLine.id).up, key = loc.dc ? `dc:${loc.id}` : "home";
    add({ id: "p:own", col: 0, label: loc.dc ? "Datacenter" : homeLineById(game.homeLine.id).isp, sub: loc.dc ? "Bandwidth" : "Home line" });
    add({ id: "u:own", col: 1, label: loc.dc ? "Datacenter bandwidth" : homeLineById(game.homeLine.id).name, sub: mbps(cap) });
    edges.push({ from: "p:own", to: "u:own", load: (used[key] ?? 0) / cap, speed: mbps(used[key] ?? 0) });
    edges.push({ from: "u:own", to: `r:${panel.id}`, load: (used[key] ?? 0) / cap, speed: mbps(cap) });
  }
  for (const u of game.network.uplinks.filter((x) => x.locationId === loc.id)) {
    const partner = carrierById(u.partner)?.name ?? exchangeById(u.partner)?.name ?? u.partner, cap = capacityMbps(u), load = cap ? (used[u.id] ?? 0) / cap : 0;
    add({ id: `p:${u.partner}`, col: 0, label: partner, sub: u.kind === "transit" ? "Carrier" : "Exchange" });
    add({ id: `u:${u.id}`, col: 1, label: `${partner} ${u.kind === "transit" ? "transit" : "ports"}`, sub: mbps(cap) });
    edges.push({ from: `p:${u.partner}`, to: `u:${u.id}`, load, speed: mbps(used[u.id] ?? 0) });
    for (const l of u.links) edges.push({ from: `u:${u.id}`, to: `r:${l.device}`, load, speed: `${l.gbit}G` });
  }
  const traffic = (serverId: string) => workloadsOn(game, serverId).reduce((n, w) => {
    const v = game.services.find((x) => x.id === w.serviceId);
    return n + (v && v.endedAt === null ? serviceMbps(game, v) : 0);
  }, 0);
  // Every port's far end of a kind, with the slowest speed on the way.
  const peers = (id: string, want: string) => modelById(game.devices.find((x) => x.id === id)!.model).ports
    .map((_, port) => farEnd(game, { device: id, port })).flatMap((f) => (f && kind(f.end.device) === want ? [f] : []));
  for (const r of routers) {
    add({ id: `r:${r.id}`, col: 2, label: name(r.id), sub: modelById(r.model).name });
    for (const sw of peers(r.id, "switch")) {
      const servers = peers(sw.end.device, "server");
      const total = servers.reduce((n, s) => n + traffic(s.end.device), 0);
      add({ id: `s:${sw.end.device}`, col: 3, label: name(sw.end.device), sub: `${servers.length} server${servers.length === 1 ? "" : "s"}` });
      edges.push({ from: `r:${r.id}`, to: `s:${sw.end.device}`, load: total / (sw.gbit * 1000), speed: `${sw.gbit}G` });
      if (servers.length > COLLAPSE && !open.includes(sw.end.device)) {
        add({ id: `n:${sw.end.device}`, col: 4, label: `${servers.length} servers`, sub: mbps(total), expand: sw.end.device });
        edges.push({ from: `s:${sw.end.device}`, to: `n:${sw.end.device}`, load: 0, speed: "" });
        continue;
      }
      for (const sv of servers) {
        const t = traffic(sv.end.device);
        add({ id: `v:${sv.end.device}`, col: 4, label: name(sv.end.device), sub: mbps(t) });
        edges.push({ from: `s:${sw.end.device}`, to: `v:${sv.end.device}`, load: t / (sv.gbit * 1000), speed: `${sv.gbit}G` });
      }
    }
  }

  const rows = Math.max(1, ...COLS.map((_, c) => nodes.filter((n) => n.col === c).length));
  const height = rows * (H + GAP_Y) + 24, width = COLS.length * (W + GAP_X) - GAP_X;
  const pos = new Map<string, { x: number; y: number }>();
  COLS.forEach((_, c) => {
    const col = nodes.filter((n) => n.col === c), top = 24 + ((rows - col.length) * (H + GAP_Y)) / 2;
    col.forEach((n, i) => pos.set(n.id, { x: c * (W + GAP_X), y: top + i * (H + GAP_Y) }));
  });

  return (
    <div className="net-topo">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Network topology">
        {COLS.map((c, i) => <text key={c} x={i * (W + GAP_X)} y="12" className="net-col">{c}</text>)}
        {edges.map((e) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
          return (
            <g key={`${e.from}-${e.to}`} className={`net-edge ${loadClass(e.load)}`}>
              <path d={`M${x1},${y1}C${mx},${y1} ${mx},${y2} ${x2},${y2}`} />
              {e.speed && <text x={mx} y={(y1 + y2) / 2 - 3} textAnchor="middle" className="num">{e.speed}</text>}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const toggle = n.expand ? () => setOpen((o) => [...o, n.expand!]) : undefined;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} className={`net-node${toggle ? " net-node-btn" : ""}`} onClick={toggle}
              role={toggle ? "button" : undefined} tabIndex={toggle ? 0 : undefined} onKeyDown={toggle ? (ev) => { if (ev.key === "Enter") toggle(); } : undefined}>
              <rect width={W} height={H} rx="7" />
              <text x="10" y="14" className="net-node-l">{n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}</text>
              <text x="10" y="27" className="net-node-s num">{n.sub}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
