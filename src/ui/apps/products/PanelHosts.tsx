import { Boxes, Globe, Plus, Server, Trash2 } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { modelById } from "../../../sim/10-catalog/hardware";
import { phpAt, phpBehind, softwareById } from "../../../sim/10-catalog/platforms";
import type { Resources } from "../../../sim/10-catalog/products";
import type { GameState } from "../../../sim/50-state";
import { anchorOf, bookable, controlPlaneUse, nodeUsed, serverTaken, vmById, vmRoom, type Cluster } from "../../../sim/60-infra/cluster";
import { PHP_EOL } from "../../../sim/60-infra/php";
import { locationOf } from "../../../sim/60-infra/status";
import { licenseCost } from "../../../sim/85-products/products";
import {
  createPanelVm, installPanel, PANEL_VM_MIN, PANEL_VM_SIZE, phpDue, removePanelHost, resizePanelVm, setSoftware, upgradePhp,
} from "../../../sim/90-actions/clusters";
import { Confirm } from "../../desktop/Confirm";
import { useStore } from "../../store";
import { devName, disk, ram } from "../hw";
import { Meter } from "../locations/Clusters";
import { Stepper } from "../shop/Cart";
import { ControlPlanePill, licenseText, Mark, SoftwareCards } from "./parts";

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
  const [pending, setPending] = useState<string | null>(null);
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
  const year = yearOf(game.hour), behind = phpBehind(host.php, year);
  const target = pending ? softwareById(pending) : null;
  const fresh = !host.panel;
  return (
    <div className="prd-pad">
      <div className="prd-title">
        <Mark id={host.panel ?? host.switching?.to ?? null} size={36} />
        <div><h2>{host.name}</h2><span className="loc-muted">{host.az}</span></div>
        <span className="grow" />
        <ControlPlanePill game={game} cluster={host} />
        {sites.length === 0 && <button className="btn" onClick={() => setRemoving(true)}><Trash2 />Remove</button>}
      </div>

      <h3 className="prd-h">Hosting panel<span className="loc-muted num">{euroCents(lic)} per month</span></h3>
      <SoftwareCards kind="panel" value={host.switching?.to ?? host.panel} onPick={(id) => { if (id !== host.panel) setPending(id); }} />

      <section className="fin-card">
        <div className="fin-card-h">{vm ? <Boxes /> : <Server />}Runs on</div>
        <dl className="fin-rows">
          <div><dt>{vm ? "Virtual machine on" : "Server"}</dt><dd>{vm ? `${onCluster?.name ?? "None"}${d ? ` · ${devName(d)}` : ""}` : d ? devName(d) : "None"}</dd></div>
          <div><dt>Web spaces</dt><dd className="num">{sites.length}</dd></div>
          <div><dt>PHP</dt><dd className="num">{host.php}{behind >= PHP_EOL ? <> <span className="pill bad">Unsupported</span></> : behind > 0 ? <> <span className="pill warn">Outdated</span></> : null}</dd></div>
        </dl>
        {phpDue(game, host) && (
          <div className="fin-card-b">
            <div className="fin-pills"><button className="btn" onClick={() => act((g) => upgradePhp(g, host.id))}>{host.php === phpAt(year) ? "Patch" : `Upgrade to ${phpAt(year)}`}</button></div>
          </div>
        )}
      </section>

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

      {target && (
        <Confirm
          title={`${fresh ? "Install" : "Switch to"} ${target.name}?`}
          text={`The panel of ${host.name} is busy for ${target.installHours} h. The license is ${licenseText(target).toLowerCase()}${target.pricing === "free" ? "" : " per month"}.`}
          action={fresh ? "Install" : "Switch"}
          onCancel={() => setPending(null)}
          onConfirm={() => { act((g) => setSoftware(g, host.id, target.id)); setPending(null); }}
        />
      )}
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

// The panel VM's booking, resized within what its web spaces need and its server has room for.
export function ResizeCard({ game, host }: { game: GameState; host: Cluster }) {
  const act = useStore((s) => s.act);
  const vm = vmById(game, host.vm)!;
  const [size, setSize] = useState<Resources>({ vcpu: vm.vcpu, ramGb: vm.ramGb, diskGb: vm.diskGb });
  const same = size.vcpu === vm.vcpu && size.ramGb === vm.ramGb && size.diskGb === vm.diskGb;
  const d = vm.deviceId ? game.devices.find((x) => x.id === vm.deviceId) : undefined;
  const room = d ? bookable(game, d) : null, used = d ? nodeUsed(game, d.id) : null;
  const inside = vmRoom(game, host).used;
  return (
    <section className="fin-card">
      <div className="fin-card-h"><Boxes />Virtual machine size</div>
      <div className="fin-card-b">
        <SizeFields value={size} onChange={setSize} />
        <dl className="fin-rows">
          <div><dt>Web spaces book</dt><dd className="num">{num(inside.vcpu)} vCPU · {ram(+inside.ramGb.toFixed(2))} · {disk(Math.round(inside.diskGb))}</dd></div>
          {room && used && <div><dt>Free on {devName(d!)}</dt><dd className="num">{num(room.vcpu - used.vcpu)} vCPU · {ram(+(room.ramGb - used.ramGb).toFixed(2))} · {disk(Math.round(room.diskGb - used.diskGb))}</dd></div>}
        </dl>
        <div><button className="btn primary" disabled={same} onClick={() => act((g) => resizePanelVm(g, host.id, size))}>Resize</button></div>
      </div>
    </section>
  );
}
