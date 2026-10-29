import { Plus } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { softwareById } from "../../../sim/10-catalog/platforms";
import type { GameState } from "../../../sim/50-state";
import { addNode } from "../../../sim/90-actions/clusters";
import { installBlock, installSoftware, joinableClusters, softwareOn, uninstallSoftware, type Installed } from "../../../sim/90-actions/software";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { devName } from "../hw";
import { KIND_NAME, Mark, SoftwareCards, vmLabel } from "../products/parts";
import "./software.css";

// The clusters a server's software can join: the zone's other clusters on the same software, while nothing runs on it.
const joinable = (game: GameState, machineId: string, x: Installed) => (x.doneAt === null ? joinableClusters(game, machineId) : []);

// The software installed on a server or one of the player's VMs as tiles, then a tile that adds more.
export function SoftwareGrid({ game, machineId }: { game: GameState; machineId: string }) {
  const { act, openApp, setSetup } = useStore.getState();
  return (
    <div className="sw-grid">
      {softwareOn(game, machineId).map((x) => {
        const open = () => openApp("Products", { kind: "cluster", id: x.cluster.id });
        const join = joinable(game, machineId, x);
        const entries = (): MenuEntry[] => [
          { label: "Open", run: open },
          join.length > 0 && { label: "Join cluster", items: join.map((c) => ({ label: c.name, run: () => act((g) => addNode(g, c.id, machineId)) })) },
          null,
          { label: "Uninstall", run: () => act((g) => uninstallSoftware(g, machineId)) },
        ];
        return (
          <button key={x.id} className="sw-tile" onClick={open} onContextMenu={menuOn(entries)}>
            <Mark id={x.id} size={32} />
            <span className="t">{softwareById(x.id).name}</span>
            {x.doneAt === null ? <span className="s">{x.cluster.name}</span> : <><span className="s">Installing</span><span className="s num">{x.doneAt - game.hour} h left</span></>}
          </button>
        );
      })}
      <button className="sw-tile sw-add" onClick={() => setSetup(machineId)}>
        <span className="sw-plus"><Plus size={18} /></span>
        <span className="t">Add Software</span>
      </button>
    </div>
  );
}

// The catalog to install on a machine; software that cannot go there is dimmed and says why when picked.
export function SoftwarePicker({ machineId }: { machineId: string }) {
  const { game, act, setSetup } = useStore();
  const close = () => setSetup(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setSetup(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setSetup]);
  const device = game.devices.find((d) => d.id === machineId), vm = game.workloads.find((w) => w.id === machineId);
  if (!device && !vm) return null;
  const name = device ? devName(device) : vmLabel(game, vm!).name;
  const pick = (id: string) => { if (act((g) => installSoftware(g, machineId, id)).ok) close(); };
  const blocked = (id: string) => installBlock(game, machineId, id) !== null;
  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert welcome setup sw-picker" role="dialog" aria-modal="true" aria-labelledby="sw-title">
        <h2 id="sw-title">Add Software to {name}</h2>
        {(["cloud", "panel", "mail"] as const).map((kind) => (
          <section key={kind} className="setup-kind">
            <h3>{KIND_NAME[kind]}</h3>
            <SoftwareCards kind={kind} value={null} onPick={pick} blocked={blocked} compact />
          </section>
        ))}
        <div className="alert-actions">
          <button className="btn" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
