import { Boxes, Globe, LayoutGrid, Plus, ShieldCheck, Tags, TriangleAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { modelById } from "../../../sim/10-catalog/hardware";
import { kindServing, softwareById } from "../../../sim/10-catalog/platforms";
import { HA_SKILL } from "../../../sim/10-catalog/research";
import { PRODUCTS } from "../../../sim/10-catalog/products";
import { homeLineById } from "../../../sim/20-world/datacenters";
import type { Product } from "../../../sim/30-customers/customers";
import type { GameState } from "../../../sim/50-state";
import { bookable, controlPlaneUp, gpuReady, hasHosts, lineOffered, supports, controlPlaneUse, fitsControlPlane, nodeUsed, serverTaken, workloadsOn, type BackupEvery, type Cluster, type Ha } from "../../../sim/60-infra/cluster";
import { installedCores, installedRamGb, locationOf, raidUsable } from "../../../sim/60-infra/status";
import { nodeUsage, peakUsage } from "../../../sim/60-infra/usage";
import { backupPool, licenseCost } from "../../../sim/85-products/products";
import { addNode, moveControlPlane, setBackup, setHa, setPlacement } from "../../../sim/90-actions/clusters";
import { joinableServers } from "../../../sim/90-actions/software";
import { useFocus, useStore } from "../../store";
import "../billing/billing.css";
import { devName, disk, ram } from "../hw";
import { Meter, NODE_STATE } from "../locations/Clusters";
import { PRODUCT } from "../support/labels";
import { NewPanelHost, PanelHostDetail } from "./PanelHosts";
import { Rates } from "./Rates";
import "../sales/sales.css";
import { ControlPlanePill, IncidentReports, KIND_NAME, Mark, servesText, softwareName } from "./parts";

type View = "lines" | "pricing" | "new" | "newHost" | "incidents" | string;
const num = (n: number) => `${+n.toFixed(1)}`;

export function ProductsApp() {
  const game = useStore((s) => s.game);
  const [view, setView] = useState<View>("lines");
  useFocus("Products", (f) => { if (f.kind === "cluster") setView(f.id); });
  const cluster = game.clusters.find((c) => c.id === view);
  const open = game.lossReports.filter((r) => r.items.some((i) => !i.restored)).length;
  const item = (id: View, label: string, icon: ReactNode, count?: number) => (
    <button key={id} className={`side-item${view === id ? " active" : ""}`} aria-pressed={view === id} onClick={() => setView(id)}>
      {icon}{label}{count !== undefined && <span className="side-count">{count}</span>}
    </button>
  );
  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Products">
        {item("lines", "Product lines", <LayoutGrid />)}
        {item("pricing", "Pricing", <Tags />)}
        {item("incidents", "Incidents", <TriangleAlert />, open)}
        <div className="side-h">Hypervisor clusters</div>
        {game.clusters.filter((c) => c.kind === "cloud").map((c) => item(c.id, c.name, <Mark id={c.platform} size={16} />, c.nodes.length))}
        <div className="side-h">Panel hosts</div>
        {game.clusters.filter((c) => c.kind === "panel").map((c) => item(c.id, c.name, <Mark id={c.panel ?? c.switching?.to ?? null} size={16} />))}
        {item("newHost", "New panel host", <Plus />)}
      </nav>
      <div className="fin-main">
        <div className="fin-scroll">
          {view === "lines" && <ProductLines game={game} />}
          {view === "pricing" && <Rates game={game} />}
          {view === "incidents" && <IncidentReports game={game} />}
          {view === "newHost" && <NewPanelHost game={game} onDone={setView} />}
          {cluster?.kind === "cloud" && <ClusterDetail game={game} cluster={cluster} />}
          {cluster?.kind === "panel" && <PanelHostDetail game={game} host={cluster} />}
        </div>
      </div>
    </div>
  );
}

const LINES: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn", "storage", "cloud", "gpu", "dedicated", "colocation"];

// Whether a zone can take new orders of a product.
function offered(game: GameState, p: Product, az: string): boolean {
  const spec = PRODUCTS[p];
  if (spec.runsOn === "cluster") return !spec.ha && game.clusters.some((c) => c.az === az && hasHosts(c) && supports(c, p) && controlPlaneUp(game, c) && (p !== "gpu" || gpuReady(game, c)));
  if (spec.runsOn === "server") return game.devices.some((d) => d.rackId && modelById(d.model).server && locationOf(game, d)?.az === az && !serverTaken(game, d.id));
  return game.locations.some((l) => l.az === az && l.dc);
}

function ProductLines({ game }: { game: GameState }) {
  const zones = [...new Set(game.locations.map((l) => l.az))];
  const live = game.services.filter((v) => v.endedAt === null);
  const line = homeLineById(game.homeLine.id);
  return (
    <div className="prd-pad">
      <section className="fin-card">
        <div className="fin-card-h"><Globe />Internet line</div>
        <table className="table">
          <thead><tr><th>Line</th><th>Addresses</th><th className="r">Monthly</th></tr></thead>
          <tbody>
            {game.homeLine.id === "" ? (
              <tr><td>No line</td><td /><td className="r"><button className="btn" onClick={() => useStore.getState().openApp("Locations")}>Open Locations</button></td></tr>
            ) : (
              <tr><td>{line.name}</td><td>{line.staticIp ? "Static" : "Dynamic"}</td><td className="r num">{euroCents(line.monthly)}</td></tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="fin-card">
        <div className="fin-card-h"><LayoutGrid />Product lines</div>
        <table className="table">
          <thead><tr><th>Product</th><th>Runs on</th>{zones.map((z) => <th key={z} className="r">{z}</th>)}<th className="r">Monthly</th></tr></thead>
          <tbody>
            {LINES.map((p) => {
              const mine = live.filter((v) => v.product === p);
              const monthly = mine.reduce((n, v) => n + (v.period === "hour" ? v.price * 730 : v.price / 12), 0);
              const kind = kindServing(p);
              return (
                <tr key={p}>
                  <td>{PRODUCT[p]}</td>
                  <td>
                    {kind ? KIND_NAME[kind] : PRODUCTS[p].runsOn === "server" ? "Whole server" : "Rack space"}
                    {kind && p !== "gpu" && !lineOffered(game, p) && <> <span className="pill bad">Not installed</span></>}
                  </td>
                  {zones.map((z) => {
                    const n = mine.filter((v) => v.zone === z).length;
                    return <td key={z} className="r num">{n > 0 ? n : offered(game, p, z) ? <span className="pill ok">Offered</span> : <span className="loc-muted">None</span>}</td>;
                  })}
                  <td className="r num">{euroCents(monthly)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const HA_ROWS: [keyof Ha, string][] = [["live", "Live migration"], ["balance", "Auto-balancing"], ["failover", "Failover"]];

// Live migration, auto-balancing and failover, each switched per cluster once researched.
function HaCard({ game, cluster }: { game: GameState; cluster: Cluster }) {
  const act = useStore((s) => s.act);
  const stuck = game.workloads.filter((w) => w.clusterId === cluster.id && w.stuck).length;
  const can = (k: keyof Ha) => k === "live" ? !cluster.platform || softwareById(cluster.platform).live : k === "balance" ? cluster.ha.live : true;
  return (
    <section className="fin-card">
      <div className="fin-card-h"><ShieldCheck />High availability<span className="grow" />{stuck > 0 && <span className="pill bad">Stuck <span className="num">{stuck}</span></span>}</div>
      {!game.unlocks.includes(HA_SKILL) ? <div className="fin-none">Not researched</div> : (
        <dl className="fin-rows">
          {HA_ROWS.map(([k, label]) => (
            <div key={k}>
              <dt>{label}</dt>
              <dd>
                <div className="seg" role="group" aria-label={label}>
                  <button aria-pressed={!cluster.ha[k]} onClick={() => act(setHa, cluster.id, k, false)}>Off</button>
                  <button aria-pressed={cluster.ha[k]} disabled={!can(k)} onClick={() => act(setHa, cluster.id, k, true)}>On</button>
                </div>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);

function ClusterDetail({ game, cluster }: { game: GameState; cluster: Cluster }) {
  const act = useStore((s) => s.act);
  const devices = cluster.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const day = Math.floor(game.hour / 24);
  // ponytail: recomputes the week's forecast once a game day; cache per node if clusters grow past a few hundred workloads.
  const peak = useMemo(() => devices.map((d) => peakUsage(game, d.id, day * 24, 168)), [game.workloads, game.clusters, day]);
  const now = devices.map((d) => nodeUsage(game, d.id));
  const cp = controlPlaneUse(cluster);
  const booked = devices.map((d) => {
    const u = nodeUsed(game, d.id), mine = cluster.controlPlane === d.id;
    return { vcpu: u.vcpu + (mine ? cp.vcpu : 0), ramGb: u.ramGb + (mine ? cp.ramGb : 0), diskGb: u.diskGb + (mine ? cp.diskGb : 0) };
  });
  const physical = devices.map((d) => ({ vcpu: installedCores(d), ramGb: installedRamGb(d), diskGb: raidUsable(d) }));
  const rows = (["vcpu", "ramGb", "diskGb"] as const).map((k) => {
    const b = sum(booked, (x) => x[k]), p = sum(physical, (x) => x[k]);
    const fmt = k === "vcpu" ? (v: number) => `${num(v)}` : k === "ramGb" ? (v: number) => ram(+v.toFixed(1)) : (v: number) => disk(Math.round(v));
    return { label: k === "vcpu" ? "CPU" : k === "ramGb" ? "RAM" : "Disk", b, p, fmt, now: sum(now, (x) => x.used[k]), peak: sum(peak, (x) => x[k]) };
  });
  const lic = licenseCost(game, cluster);
  const host = game.devices.find((d) => d.id === cluster.controlPlane);
  const others = game.clusters.filter((c) => c.id !== cluster.id);
  const pool = cluster.backup.targetId ? backupPool(game, cluster.backup.targetId) : null;
  const free = joinableServers(game, cluster.id).map((id) => game.devices.find((d) => d.id === id)!);

  return (
    <div className="prd-pad">
      <div className="prd-title">
        <Mark id={cluster.platform} size={36} />
        <div><h2>{cluster.name}</h2><span className="loc-muted">{cluster.az}</span></div>
        <span className="grow" />
        <ControlPlanePill game={game} cluster={cluster} />
        <div className="seg" role="group" aria-label="Placement">
          <button aria-pressed={cluster.placement === "pack"} onClick={() => act(setPlacement, cluster.id, "pack")}>Pack</button>
          <button aria-pressed={cluster.placement === "spread"} onClick={() => act(setPlacement, cluster.id, "spread")}>Spread</button>
        </div>
      </div>

      <h3 className="prd-h">{softwareName(cluster.switching?.to ?? cluster.platform)}<span className="loc-muted">{servesText("cloud")}</span><span className="loc-muted num">{euroCents(lic.platform)} per month</span></h3>

      <HaCard game={game} cluster={cluster} />

      <section className="fin-card">
        <div className="fin-card-h"><Boxes />Capacity</div>
        <table className="table">
          <thead><tr><th /><th className="r">Booked</th><th className="r">Physical</th><th className="r">Overcommit</th><th className="r">In use now</th><th className="r">Peak this week</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="r num">{r.fmt(r.b)}{r.label === "CPU" ? " vCPU" : ""}</td>
                <td className="r num">{r.fmt(r.p)}{r.label === "CPU" ? " cores" : ""}</td>
                <td className={`r num${r.b > r.p ? " prd-over" : ""}`}>{r.p ? `${num(r.b / r.p)}:1` : "None"}</td>
                <td className="r num">{r.fmt(r.now)}</td>
                <td className={`r num${r.peak > r.p ? " prd-over" : ""}`}>{r.fmt(r.peak)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="fin-card">
        <div className="fin-card-h"><Boxes />Nodes<span className="grow" /><span className="num loc-muted">{devices.length}</span></div>
        {devices.length === 0 && <div className="fin-none">No nodes</div>}
        {devices.length > 0 && (
          <table className="table">
            <thead><tr><th>Server</th><th>State</th><th className="r">Workloads</th><th>RAM booked</th><th>CPU now</th><th /></tr></thead>
            <tbody>
              {devices.map((d, i) => {
                const n = cluster.nodes.find((x) => x.deviceId === d.id)!, [label, tone] = NODE_STATE[n.state], cap = bookable(game, d);
                return (
                  <tr key={d.id}>
                    <td>{devName(d)}</td>
                    <td><span className={`pill ${tone}`}>{label}</span></td>
                    <td className="r num">{workloadsOn(game, d.id).length}</td>
                    <td><Meter used={booked[i].ramGb} cap={cap.ramGb + (cluster.controlPlane === d.id ? cp.ramGb : 0)} text={`${ram(+booked[i].ramGb.toFixed(1))} of ${ram(+(cap.ramGb + (cluster.controlPlane === d.id ? cp.ramGb : 0)).toFixed(1))}`} /></td>
                    <td><Meter used={now[i].used.vcpu} cap={physical[i].vcpu} text={`${num(now[i].used.vcpu)} of ${physical[i].vcpu}`} /></td>
                    <td className="r">{now[i].perf < 1 && <span className="pill warn">Slow {Math.round(now[i].perf * 100)}%</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {free.length > 0 && (
          <div className="fin-card-b">
            <div className="fin-pills">{free.map((d) => <button key={d.id} className="btn" onClick={() => act(addNode, cluster.id, d.id)}><Plus />{devName(d)}</button>)}</div>
          </div>
        )}
      </section>

      <section className="fin-card">
        <div className="fin-card-h"><Boxes />Control plane</div>
        <dl className="fin-rows">
          <div><dt>Host</dt><dd>{host ? devName(host) : "None"}</dd></div>
          <div><dt>Reserved</dt><dd className="num">{num(cp.vcpu)} vCPU · {ram(+cp.ramGb.toFixed(2))} · {disk(cp.diskGb)}</dd></div>
          <div><dt>Licenses per month</dt><dd className="num">{euroCents(lic.panel + lic.platform)}</dd></div>
        </dl>
        {devices.some((d) => d.id !== cluster.controlPlane && fitsControlPlane(game, cluster, d.id)) && (
          <div className="fin-card-b">
            <div className="fin-pills">
              {devices.filter((d) => d.id !== cluster.controlPlane && fitsControlPlane(game, cluster, d.id)).map((d) => (
                <button key={d.id} className="btn" onClick={() => act(moveControlPlane, cluster.id, d.id)}>Move to {devName(d)}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="fin-card">
        <div className="fin-card-h"><Boxes />Backups</div>
        <div className="fin-card-b">
          <div className="seg" role="group" aria-label="Schedule">
            {(["off", "daily", "weekly"] as BackupEvery[]).map((e) => (
              <button key={e} aria-pressed={cluster.backup.every === e} disabled={e !== "off" && !cluster.backup.targetId && !others.length}
                onClick={() => act(setBackup, cluster.id, e === "off" ? cluster.backup.targetId : cluster.backup.targetId ?? others[0].id, e)}>
                {e === "off" ? "Off" : e === "daily" ? "Daily" : "Weekly"}
              </button>
            ))}
          </div>
          {others.length > 0 && (
            <div className="seg" role="group" aria-label="Backup target">
              {others.map((c) => (
                <button key={c.id} aria-pressed={cluster.backup.targetId === c.id} onClick={() => act(setBackup, cluster.id, c.id, cluster.backup.every)}>{c.name} · {c.az}</button>
              ))}
            </div>
          )}
          {pool && <dl className="fin-rows"><div><dt>Backup pool</dt><dd className="num">{disk(Math.round(pool.need))} of {disk(Math.max(0, Math.round(pool.room)))} free</dd></div></dl>}
        </div>
      </section>

    </div>
  );
}
