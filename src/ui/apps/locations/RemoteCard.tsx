import { MonitorCog } from "lucide-react";
import type { ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { BMC_NAME, modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { oobIp } from "../../../sim/60-infra/addresses";
import {
  ATX_PRICE, consoleHolder, consoleVia, exposed, firmwareDue, isGear, isMgmtDevice, mgmtVia, MODEM_FROM, oobUp, remoteFix, UPLINK_MONTHLY,
} from "../../../sim/60-infra/oob";
import { fitAtx, recoverGear, setUplink, updateFirmware } from "../../../sim/90-actions/remote";
import { useStore } from "../../store";
import { useHandWork } from "./HandSheet";
import { Facts } from "./ui";

const nameOf = (d: Device) => d.label ?? d.name;

// Console, management port and firmware of a server, a switch or router, or a management device.
export function RemoteCard({ game, device }: { game: GameState; device: Device }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const hand = useHandWork();
  const m = modelById(device.model), server = m.kind === "server", gear = isGear(device), mgmt = isMgmtDevice(device);
  if (!device.rackId || (!server && !gear && !mgmt)) return null;
  const link = (ip: string | null) => ip && <button className="loc-link num" onClick={() => openApp("Browser", { kind: "url", id: `http://${ip}/` })}>{ip}</button>;
  const via = consoleVia(game, device.id), holder = consoleHolder(game, device);
  if (server && !via && !holder) return null;
  const rows: [string, ReactNode][] = [];
  if (server || gear) rows.push(["Console", via ? (via.kind === "bmc" ? BMC_NAME[device.brand] : nameOf(via.device)) : holder ? `${nameOf(holder)}, unreachable` : "None"]);
  if (server && holder && modelById(holder.model).kind === "kvm") rows.push(["KVM page", link(oobIp(game, holder.id))]);
  if (gear) { const sw = mgmtVia(game, device.id); rows.push(["MGMT", sw ? nameOf(sw) : "None"]); }
  if (mgmt) {
    rows.push(["Address", link(oobIp(game, device.id))], ["Reachable", oobUp(game, device.id) ? "Yes" : "No"], ["Internet", exposed(game, device) ? "Exposed" : "Private"]);
  }
  if (device.fw) rows.push(["Firmware", `${device.fw.version}`]);
  const kvm = server && holder && modelById(holder.model).kind === "kvm" && !modelById(holder.model).atx && !device.atx;
  const fix = remoteFix(game, device);
  const recover = () => (fix ? act(recoverGear, device.id) : hand.start(game, { title: `Recover ${nameOf(device)}`, deviceId: device.id, action: recoverGear, args: [device.id], tech: { kind: "gear" } }));
  const lines = m.kind === "oob" || m.kind === "console";
  const modem = m.kind === "console" && yearOf(game.hour) >= MODEM_FROM;
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><MonitorCog />Remote access</h3></div>
      <Facts rows={rows} />
      {lines && (
        <div className="loc-row insp-bond">
          <span className="loc-k">Way in</span>
          <div className="seg" role="group" aria-label="Way in">
            <button aria-pressed={!device.uplink} onClick={() => act(setUplink, device.id, null)}>None</button>
            <button aria-pressed={device.uplink === "dsl"} onClick={() => act(setUplink, device.id, "dsl")}>DSL {euro(UPLINK_MONTHLY.dsl)}/mo</button>
            {modem && <button aria-pressed={device.uplink === "modem"} onClick={() => act(setUplink, device.id, "modem")}>Modem {euro(UPLINK_MONTHLY.modem)}/mo</button>}
          </div>
        </div>
      )}
      {(kvm || (gear && (device.hung || device.locked)) || device.fw) && (
        <div className="loc-row insp-power-row">
          {kvm && <button className="btn" onClick={() => act(fitAtx, device.id)}>Fit ATX adapter {euro(ATX_PRICE)}</button>}
          {gear && (device.hung || device.locked) && <button className="btn primary" disabled={!!device.hands} onClick={recover}>{fix ? "Recover over console" : "Recover"}</button>}
          {device.fw && <button className="btn" disabled={!firmwareDue(game, device)} onClick={() => act(updateFirmware, device.id)}>Update firmware</button>}
        </div>
      )}
      {hand.dialog}
    </div>
  );
}
