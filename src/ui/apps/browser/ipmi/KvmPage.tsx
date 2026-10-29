import { MonitorCog } from "lucide-react";
import { t } from "../../../../i18n/en";
import { modelById } from "../../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../../sim/50-state";
import { consoleScreen, kvmPower, targetsOf } from "../../../../sim/60-infra/oob";
import { deviceHealth } from "../../../../sim/60-infra/status";
import { remotePower, reset } from "../../../../sim/90-actions/hardware";
import { continueBoot, recoverGear } from "../../../../sim/90-actions/remote";
import { useStore } from "../../../store";
import "../consoles/consoles.css";
import "./ipmi.css";

const nameOf = (d: Device) => d.hostname ?? d.label ?? d.name;
export const kvmTitle = (d: Device): string => `${modelById(d.model).name} ${d.label ?? d.name}`;

// One device behind the KVM or console server: its state, the power buttons the KVM can press, and the console's last line.
function Target({ game, d }: { game: GameState; d: Device }) {
  const act = useStore((s) => s.act), openConsole = useStore((s) => s.openConsole);
  const state = deviceHealth(game, d.id).state, screen = consoleScreen(d, state), server = modelById(d.model).kind === "server";
  const power = server && !!kvmPower(game, d);
  return (
    <section className="kvm-target">
      <dl className="bmc-facts">
        <div><dt>{server ? "Server" : "Device"}</dt><dd>{nameOf(d)}</dd></div>
        <div><dt>Power</dt><dd className={`bmc-state ${d.on ? "on" : "off"}`}>{d.on ? "On" : "Off"}</dd></div>
      </dl>
      <pre className="kvm-screen">{t(screen.key, screen.params)}</pre>
      <div className="bmc-actions">
        {server && <button className="cx-btn" onClick={() => openConsole(d.id)}>Open console</button>}
        {power && <button className="cx-btn primary" disabled={d.on} onClick={() => act(remotePower, d.id, true)}>Power on</button>}
        {power && <button className="cx-btn" disabled={!d.on} onClick={() => act(remotePower, d.id, false)}>Power off</button>}
        {power && <button className="cx-btn" disabled={!d.on} onClick={() => act(reset, d.id)}>Reset</button>}
        {d.stuck && d.on && <button className="cx-btn" onClick={() => act(continueBoot, d.id)}>Continue boot</button>}
        {!server && (d.hung || d.locked) && <button className="cx-btn" onClick={() => act(recoverGear, d.id)}>Recover over console</button>}
      </div>
    </section>
  );
}

// The plain page of a KVM, console server or OOB switch: every device it holds.
export function KvmPage({ game, deviceId, host }: { game: GameState; deviceId: string; host: string }) {
  const d = game.devices.find((x) => x.id === deviceId);
  if (!d) return null;
  const targets = targetsOf(game, d);
  return (
    <div className="cx" data-look="kvm" data-frame="top">
      <header className="cx-head">
        <span className="cx-brand"><span className="bmc-mark"><MonitorCog size={14} /></span><b>{kvmTitle(d)}</b></span>
        <span className="cx-host">{host}</span>
      </header>
      <main className="cx-main">
        {targets.map((x) => <Target key={x.id} game={game} d={x} />)}
        {!targets.length && <p className="bmc-empty">No devices</p>}
      </main>
    </div>
  );
}
