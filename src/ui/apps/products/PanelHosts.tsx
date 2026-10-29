import { Boxes, Globe, Plus, Server } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { modelById } from "../../../sim/10-catalog/hardware";
import { phpAt, phpBehind } from "../../../sim/10-catalog/platforms";
import type { Resources } from "../../../sim/10-catalog/products";
import type { GameState } from "../../../sim/50-state";
import { anchorOf, bookable, controlPlaneUse, nodeUsed, serverTaken, vmById, vmRoom, type Cluster, type Workload } from "../../../sim/60-infra/cluster";
import { PHP_EOL } from "../../../sim/60-infra/php";
import { locationOf } from "../../../sim/60-infra/status";
import { licenseCost } from "../../../sim/85-products/products";
import {
  addNode, createPanelVm, installPanel, PANEL_VM_MIN, PANEL_VM_SIZE, phpDue, removePanelHost, resizePanelVm, resizeVm, upgradePhp,
} from "../../../sim/90-actions/clusters";
import { cleanUp, setSitesOffline } from "../../../sim/90-actions/security";
import { Confirm } from "../../desktop/Confirm";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { useStore } from "../../store";
import { devName, disk, ram } from "../hw";
import { Meter } from "../locations/Clusters";
import { Stepper } from "../shop/Cart";
import { ControlPlanePill, Mark, SoftwareCards, softwareName, VM_STATE, vmState } from "./parts";
import { joinableServers } from "../../../sim/90-actions/software";
import { announceEntries, migrateEntries, offerEntries } from "../vms/migrate";

const num = (n: number) => `${+n.toFixed(2)}`;

// vCPU, RAM and disk of a VM as steppers.
export function SizeFields({ value, onChange }: { value: Resources; onChange: (r: Resources) => void }) {
  return (
    <dl className="fin-rows">
      <div><dt>vCPU</dt><dd><Stepper label="vCPU" value={value.vcpu} min={PANEL_VM_MIN.vcpu} onChange={(vcpu) => onChange({ ...value, vcpu })} /></dd></div>
      <div><dt>RAM, GB</dt><dd><Stepper label="RAM" value={value.ramGb} min={PANEL_VM_MIN.ramGb} onChange={(ramGb) => onChange({ ...value, ramGb })} /></dd></div>
      <div><dt>Disk, GB</dt><dd><Stepper label="Disk" value={value.diskGb} min={PANEL_VM_MIN.diskGb} step={10} onChange={(diskGb) => onChange({ ...value, diskGb })} /></dd></div>
    </dl>
  );
}

// Mounted servers that run no control plane and no customer.
export const freeServers = (game: GameState) =>
  game.devices.filter((d) => d.rackId && modelById(d.model).kind === "server" && !serverTaken(game, d.id));
// Hypervisor clusters with a hypervisor installed or installing.
export const hypervisors = (game: GameState) => game.clusters.filter((c) => c.kind === "cloud" && (c.platform || c.switching));

// A new panel host: a panel straight on a free server, or a panel VM on a hypervisor cluster.
export function NewPanelHost({ game, onDone }: { game: GameState; onDone: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const servers = freeServers(game), clusters = hypervisors(game);
  const [where, setWhere] = useState<"vm" | "server">(clusters.length ? "vm" : "server");
  const [target, setTarget] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [size, setSize] = useState<Resources>(PANEL_VM_SIZE);
  const options = where === "vm" ? clusters.map((c) => ({ id: c.id, name: `${c.name} · ${c.az}` })) : servers.map((d) => ({ id: d.id, name: `${devName(d)} · ${locationOf(game, d)?.az}` }));
  const chosen = options.some((o) => o.id === target) ? target : options[0]?.id ?? null;
  const create = () => {
    if (!chosen || !panel) return;
    const r = act((g) => (where === "vm" ? createPanelVm(g, chosen, panel, size) : installPanel(g, chosen, panel)));
    if (r.ok && r.id) onDone(r.id);
  };
  return (
    <div className="prd-pad">
      <section className="fin-card">
        <div className="fin-card-h"><Plus />New panel host</div>
        <div className="fin-card-b">
          <div className="seg" role="group" aria-label="Runs on">
            <button aria-pressed={where === "vm"} onClick={() => setWhere("vm")}>Virtual machine</button>
            <button aria-pressed={where === "server"} onClick={() => setWhere("server")}>Server</button>
          </div>
          {options.length === 0 ? <div className="fin-none">{where === "vm" ? "No hypervisor clusters" : "No free servers"}</div> : (
            <div className="seg" role="group" aria-label={where === "vm" ? "Cluster" : "Server"}>
              {options.map((o) => <button key={o.id} aria-pressed={o.id === chosen} onClick={() => setTarget(o.id)}>{o.name}</button>)}
            </div>
          )}
          {where === "vm" && <SizeFields value={size} onChange={setSize} />}
        </div>
      </section>
      <SoftwareCards kind="panel" value={panel} onPick={setPanel} />
      <div><button className="btn primary" disabled={!chosen || !panel} onClick={create}><Plus />Create panel host</button></div>
    </div>
  );
}

// A panel host: its panel, where it runs, its web hosting capacity, PHP and licence.
export function PanelHostDetail({ game, host }: { game: GameState; host: Cluster }) {
  const act = useStore((s) => s.act);
  const [removing, setRemoving] = useState(false);
  const vm = vmById(game, host.vm), at = anchorOf(game, host), d = game.devices.find((x) => x.id === at);
  const onCluster = vm && game.clusters.find((c) => c.id === vm.clusterId);
  const sites = game.workloads.filter((w) => w.clusterId === host.id);
  const panel = controlPlaneUse(host);
  const booked: Resources = { vcpu: panel.vcpu, ramGb: panel.ramGb, diskGb: panel.diskGb };
  for (const w of sites) { booked.vcpu += w.vcpu; booked.ramGb += w.ramGb; booked.diskGb += w.diskGb; }
  const cap: Resources = vm ? { vcpu: vm.vcpu, ramGb: vm.ramGb, diskGb: vm.diskGb }
    : d ? (() => { const b = bookable(game, d); return { vcpu: b.vcpu + panel.vcpu, ramGb: b.ramGb + panel.ramGb, diskGb: b.diskGb + panel.diskGb }; })() : { vcpu: 0, ramGb: 0, diskGb: 0 };
  const lic = licenseCost(game, host).panel;
  const joinable = joinableServers(game, host.id).map((id) => game.devices.find((d) => d.id === id)!);
  const year = yearOf(game.hour), behind = phpBehind(host.php, year);
  const menu = (): MenuEntry[] => [
    phpDue(game, host) && { label: host.php === phpAt(year) ? "Patch PHP" : `Upgrade to PHP ${phpAt(year)}`, run: () => act((g) => upgradePhp(g, host.id)) },
    ...sitesMenu(game, host),
    ...announceEntries(game, host.id),
    null,
    sites.length === 0 && { label: "Remove...", run: () => setRemoving(true) },
  ];
  return (
    <div className="prd-pad">
      <div className="prd-title" onContextMenu={menuOn(menu)}>
        <Mark id={host.panel ?? host.switching?.to ?? null} size={36} />
        <div><h2>{host.name}</h2><span className="loc-muted">{host.az}</span></div>
        <span className="grow" />
        <ControlPlanePill game={game} cluster={host} />
        <More label={host.name} entries={menu} />
      </div>

      <h3 className="prd-h">{softwareName(host.switching?.to ?? host.panel)}<span className="loc-muted num">{euroCents(lic)} per month</span></h3>

      <section className="fin-card">
        <div className="fin-card-h">{vm ? <Boxes /> : <Server />}Runs on</div>
        <dl className="fin-rows">
          <div><dt>{vm ? "Virtual machine on" : "Server"}</dt><dd>{vm ? `${onCluster?.name ?? "None"}${d ? ` · ${devName(d)}` : ""}` : d ? devName(d) : "None"}</dd></div>
          <div><dt>Web spaces</dt><dd className="num">{sites.length}</dd></div>
          <div><dt>PHP</dt><dd className="num">{host.php}{behind >= PHP_EOL ? <> <span className="pill bad">Unsupported</span></> : behind > 0 ? <> <span className="pill warn">Outdated</span></> : null}</dd></div>
        </dl>
      </section>

      {(host.nodes.length > 1 || joinable.length > 0) && (
        <section className="fin-card">
          <div className="fin-card-h"><Server />Servers</div>
          <table className="table">
            <tbody>
              {host.nodes.map((n) => { const nd = game.devices.find((x) => x.id === n.deviceId); return <tr key={n.deviceId}><td>{nd ? devName(nd) : n.deviceId}</td><td className="r">{host.controlPlane === n.deviceId ? "Control plane" : ""}</td></tr>; })}
            </tbody>
          </table>
          {joinable.length > 0 && (
            <div className="fin-card-b">
              <div className="fin-pills">{joinable.map((x) => <button key={x.id} className="btn" onClick={() => act((g) => addNode(g, host.id, x.id))}><Plus />{devName(x)}</button>)}</div>
            </div>
          )}
        </section>
      )}

      {sites.length > 0 && (
        <section className="fin-card">
          <div className="fin-card-h"><Globe />Web spaces</div>
          <table className="table">
            <thead><tr><th>Web space</th><th className="r">Disk</th><th>Status</th><th /></tr></thead>
            <tbody>
              {sites.map((w) => {
                const label = game.services.find((v) => v.id === w.serviceId)?.label ?? w.id, [state, tone] = VM_STATE[vmState(game, w)];
                const entries = () => [...migrateEntries(game, w), ...offerEntries(game, w)];
                return (
                  <tr key={w.id} onContextMenu={menuOn(entries)}>
                    <td>{label}</td>
                    <td className="r num">{disk(Math.round(w.diskGb))}</td>
                    <td><span className={`pill ${tone}`}>{state}</span></td>
                    <td className="r"><More label={label} entries={entries} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="fin-card">
        <div className="fin-card-h"><Globe />Web hosting capacity</div>
        <table className="table">
          <thead><tr><th /><th>Booked</th></tr></thead>
          <tbody>
            <tr><td>CPU</td><td><Meter used={booked.vcpu} cap={cap.vcpu} text={`${num(booked.vcpu)} of ${num(cap.vcpu)} vCPU`} /></td></tr>
            <tr><td>RAM</td><td><Meter used={booked.ramGb} cap={cap.ramGb} text={`${ram(+booked.ramGb.toFixed(2))} of ${ram(+cap.ramGb.toFixed(2))}`} /></td></tr>
            <tr><td>Disk</td><td><Meter used={booked.diskGb} cap={cap.diskGb} text={`${disk(Math.round(booked.diskGb))} of ${disk(Math.round(cap.diskGb))}`} /></td></tr>
          </tbody>
        </table>
      </section>

      {vm && <ResizeCard game={game} host={host} />}

      {removing && (
        <Confirm
          title={`Remove ${host.name}?`}
          text={vm ? "The virtual machine is deleted." : "The server is free again."}
          action="Remove"
          onCancel={() => setRemoving(false)}
          onConfirm={() => { act((g) => removePanelHost(g, host.id)); setRemoving(false); }}
        />
      )}
    </div>
  );
}

// Taking a panel host's sites offline, back online, or cleaning them up after a breach.
export function sitesMenu(game: GameState, host: Cluster): MenuEntry[] {
  const act = useStore.getState().act, sec = game.security;
  if (sec.hacked.includes(host.id)) return [{ label: "Clean up sites", run: () => act((g) => cleanUp(g, host.id)) }];
  const off = sec.offline.includes(host.id);
  return [{ label: off ? "Bring sites online" : "Take sites offline", run: () => act((g) => setSitesOffline(g, host.id, !off)) }];
}

// A VM's booking, resized within the disk its web spaces need and its server has; a VM without a panel host has no web spaces.
export function ResizeCard({ game, host, own }: { game: GameState; host?: Cluster; own?: Workload }) {
  const act = useStore((s) => s.act);
  const vm = own ?? vmById(game, host!.vm)!;
  const [size, setSize] = useState<Resources>({ vcpu: vm.vcpu, ramGb: vm.ramGb, diskGb: vm.diskGb });
  const same = size.vcpu === vm.vcpu && size.ramGb === vm.ramGb && size.diskGb === vm.diskGb;
  const d = vm.deviceId ? game.devices.find((x) => x.id === vm.deviceId) : undefined;
  const room = d ? bookable(game, d) : null, used = d ? nodeUsed(game, d.id) : null;
  const inside = host ? vmRoom(game, host).used : null;
  return (
    <section className="fin-card">
      <div className="fin-card-h"><Boxes />Virtual machine size</div>
      <div className="fin-card-b">
        <SizeFields value={size} onChange={setSize} />
        <dl className="fin-rows">
          {inside && <div><dt>Web spaces book</dt><dd className="num">{num(inside.vcpu)} vCPU · {ram(+inside.ramGb.toFixed(2))} · {disk(Math.round(inside.diskGb))}</dd></div>}
          {room && used && <div><dt>Free on {devName(d!)}</dt><dd className="num">{num(Math.max(0, room.vcpu - used.vcpu))} vCPU · {ram(+Math.max(0, room.ramGb - used.ramGb).toFixed(2))} · {disk(Math.round(Math.max(0, room.diskGb - used.diskGb)))}</dd></div>}
        </dl>
        <div><button className="btn primary" disabled={same} onClick={() => act((g) => (host ? resizePanelVm(g, host.id, size) : resizeVm(g, vm.id, size)))}>Resize</button></div>
      </div>
    </section>
  );
}
