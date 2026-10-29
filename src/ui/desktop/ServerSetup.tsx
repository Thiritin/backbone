import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Resources } from "../../sim/10-catalog/products";
import { modelById } from "../../sim/10-catalog/hardware";
import type { GameState } from "../../sim/50-state";
import { serverTaken } from "../../sim/60-infra/cluster";
import { linkStatus, locationOf } from "../../sim/60-infra/status";
import { addNode, createCluster, createPanelVm, installPanel, PANEL_VM_SIZE, setSoftware } from "../../sim/90-actions/clusters";
import { SizeFields } from "../apps/products/PanelHosts";
import { KIND_NAME, servesText, SoftwareCards } from "../apps/products/parts";
import { useStore } from "../store";

// A free server that came online before any cluster exists; its setup sheet opens once per session.
const firstServer = (g: GameState): string | null => g.clusters.length ? null
  : g.devices.find((d) => modelById(d.model).kind === "server" && !serverTaken(g, d.id) && linkStatus(g, d.id).online)?.id ?? null;

export function useFirstServerSetup() {
  const id = useStore((s) => firstServer(s.game)), setSetup = useStore((s) => s.setSetup);
  const offered = useRef(new Set<string>());
  useEffect(() => {
    if (!id || offered.current.has(id)) return;
    offered.current.add(id);
    setSetup(id);
  }, [id, setSetup]);
}

// The first-time setup of a free server: a panel server, or a hypervisor followed by its first panel VM. A hypervisor
// without any panel host yet opens on the panel VM step.
export function ServerSetup({ deviceId }: { deviceId: string }) {
  const { game, act, setSetup } = useStore();
  const hv = game.clusters.find((c) => c.kind === "cloud" && c.nodes.some((n) => n.deviceId === deviceId));
  const [step, setStep] = useState<"server" | "vm">(hv ? "vm" : "server");
  const [kind, setKind] = useState<"panel" | "cloud">("panel");
  const [pick, setPick] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [size, setSize] = useState<Resources>(PANEL_VM_SIZE);
  const device = game.devices.find((d) => d.id === deviceId);
  const close = () => setSetup(null);
  const friendsWait = !game.customers.some((c) => c.habit === "friend");

  const install = () => {
    if (!pick) return;
    if (kind === "panel") {
      if (act((s) => installPanel(s, deviceId, pick)).ok) close();
      return;
    }
    const ok = act((s) => {
      const loc = locationOf(s, s.devices.find((d) => d.id === deviceId)!)!;
      const c = createCluster(s, loc.id, `${loc.name} ${s.clusters.filter((x) => x.az === loc.az).length + 1}`);
      if (!c.ok) return c;
      const n = addNode(s, c.id!, deviceId);
      return n.ok ? setSoftware(s, c.id!, pick) : n;
    }).ok;
    if (ok) setStep("vm");
  };
  const createVm = () => { if (hv && panel && act((s) => createPanelVm(s, hv.id, panel, size)).ok) close(); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setSetup(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setSetup]);

  if (!device) return null;
  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      {step === "server" && (
        <div className="alert welcome setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">
          <h2 id="setup-title">Set up {device.name}</h2>
          <p>{friendsWait ? "Choose what this server runs. Jonas, Mira and Tobi are waiting for web hosting." : "Choose what this server runs."}</p>
          <div className="seg" role="group" aria-label="Role">
            <button aria-pressed={kind === "panel"} onClick={() => { setKind("panel"); setPick(null); }}>Panel server</button>
            <button aria-pressed={kind === "cloud"} onClick={() => { setKind("cloud"); setPick(null); }}>Hypervisor</button>
          </div>
          <section className="setup-kind">
            <h3>{KIND_NAME[kind]}<span>{servesText(kind)}</span></h3>
            <SoftwareCards kind={kind} value={pick} onPick={setPick} compact />
          </section>
          <div className="alert-actions">
            <button className="btn" onClick={close}>Skip</button>
            <button className="btn primary" disabled={!pick} onClick={install}>{kind === "panel" ? "Install" : "Next"}</button>
          </div>
        </div>
      )}
      {step === "vm" && (
        <div className="alert welcome setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">
          <h2 id="setup-title">Panel VM</h2>
          <p>Size the virtual machine that hosts your web spaces and choose its panel.</p>
          <SizeFields value={size} onChange={setSize} />
          <section className="setup-kind">
            <h3>{KIND_NAME.panel}<span>{servesText("panel")}</span></h3>
            <SoftwareCards kind="panel" value={panel} onPick={setPanel} compact />
          </section>
          <div className="alert-actions">
            <button className="btn" onClick={close}>Skip</button>
            <button className="btn primary" disabled={!panel || !hv} onClick={createVm}>Create</button>
          </div>
        </div>
      )}
    </div>,
    document.querySelector(".desktop")!,
  );
}
