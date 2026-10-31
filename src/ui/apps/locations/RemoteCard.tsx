import { MonitorCog } from "lucide-react";
import type { ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { BMC_NAME, modelById, oobPorts } from "../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../sim/50-state";
import { oobIp } from "../../../sim/60-infra/addresses";
import {
  ATX_PRICE, consoleHolder, consoleVia, exposed, firmwareDue, isGear, isMgmtDevice, mgmtVia, MODEM_FROM, oobUp, remoteFix, UPLINK_MONTHLY,
} from "../../../sim/60-infra/oob";
import { fitAtx, recoverGear, setUplink, updateFirmware } from "../../../sim/90-actions/remote";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { useHandWork } from "./HandSheet";
import { Facts } from "./ui";

const nameOf = (d: Device) => d.label ?? d.name;

// Console, management port and firmware of a server, a switch or router, or a management device.
export function RemoteCard({ game, device }: { game: GameState; device: Device }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const hand = useHandWork();
  const m = modelById(device.model), server = m.kind === "server", gear = isGear(device), mgmt = isMgmtDevice(device);
  if (!device.rackId || (!server && !gear && !mgmt) || (gear && !oobPorts(m).length)) return null;
  const link = (ip: string | null) => ip && <button className="loc-link num" onClick={() => openApp("Browser", { kind: "url", id: `http://${ip}/` })}>{ip}</button>;
  const via = consoleVia(game, device.id), holder = consoleHolder(game, device);
  if (server && !via && !holder) return null;
  const rows: [string, ReactNode][] = [];
  if (server || gear) rows.push([t("locations-2.console"), via ? (via.kind === "bmc" ? BMC_NAME[device.brand] : nameOf(via.device)) : holder ? t("locations-2.unreachable", { name: nameOf(holder) }) : t("locations-2.none")]);
  if (server && holder && modelById(holder.model).kind === "kvm") rows.push([t("locations-2.kvmPage"), link(oobIp(game, holder.id))]);
  if (gear) { const sw = mgmtVia(game, device.id); rows.push([t("locations-2.mgmt"), sw ? nameOf(sw) : t("locations-2.none")]); }
  if (mgmt) {
    rows.push([t("locations-2.address"), link(oobIp(game, device.id))], [t("locations-2.reachable"), oobUp(game, device.id) ? t("locations-2.yes") : t("locations-2.no")], [t("locations-2.internet"), exposed(game, device) ? t("locations-2.exposed") : t("locations-2.private")]);
  }
  if (device.fw) rows.push([t("locations-2.firmware"), `${device.fw.version}`]);
  const kvm = server && holder && modelById(holder.model).kind === "kvm" && !modelById(holder.model).atx && !device.atx;
  const fix = remoteFix(game, device);
  const recover = () => (fix ? act(recoverGear, device.id) : hand.start(game, { title: t("locations-2.recoverName", { name: nameOf(device) }), deviceId: device.id, action: recoverGear, args: [device.id], tech: { kind: "gear" } }));
  const lines = m.kind === "oob" || m.kind === "console";
  const modem = m.kind === "console" && yearOf(game.hour) >= MODEM_FROM;
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><MonitorCog />{t("locations-2.remoteAccess")}</h3></div>
      <Facts rows={rows} />
      {lines && (
        <div className="loc-row insp-bond">
          <span className="loc-k">{t("locations-2.wayIn")}</span>
          <div className="seg" role="group" aria-label={t("locations-2.wayIn")}>
            <button aria-pressed={!device.uplink} onClick={() => act(setUplink, device.id, null)}>{t("locations-2.none")}</button>
            <button aria-pressed={device.uplink === "dsl"} onClick={() => act(setUplink, device.id, "dsl")}>{t("locations-2.dslPrice", { amount: euro(UPLINK_MONTHLY.dsl) })}</button>
            {modem && <button aria-pressed={device.uplink === "modem"} onClick={() => act(setUplink, device.id, "modem")}>{t("locations-2.modemPrice", { amount: euro(UPLINK_MONTHLY.modem) })}</button>}
          </div>
        </div>
      )}
      {(kvm || (gear && (device.hung || device.locked)) || device.fw) && (
        <div className="loc-row insp-power-row">
          {kvm && <button className="btn" onClick={() => act(fitAtx, device.id)}>{t("locations-2.fitAtx", { price: euro(ATX_PRICE) })}</button>}
          {gear && (device.hung || device.locked) && <button className="btn primary" disabled={!!device.hands} onClick={recover}>{fix ? t("locations-2.recoverConsole") : t("locations-2.recover")}</button>}
          {device.fw && <button className="btn" disabled={!firmwareDue(game, device)} onClick={() => act(updateFirmware, device.id)}>{t("locations-2.updateFirmware")}</button>}
        </div>
      )}
      {hand.dialog}
    </div>
  );
}
