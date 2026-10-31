import { t } from "../../../../../i18n/en";
import { formatClock } from "../../../../../sim/00-core/time";
import { imageName, imageOf } from "../../../../../sim/10-catalog/server-os";
import type { GameState } from "../../../../../sim/50-state";
import { vmById, type Cluster } from "../../../../../sim/60-infra/cluster";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { nodeUsage } from "../../../../../sim/60-infra/usage";
import { updateDue } from "../../../../../sim/90-actions/software";
import { Bar, Facts, type Fact } from "../PanelBase";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0);

// Webmin's System Information dashboard, read from the host's own machine.
export function SystemInfo({ game, c, host }: { game: GameState; c: Cluster; host: string }) {
  const w = c.vm ? vmById(game, c.vm) : undefined, device = game.devices.find((d) => d.id === c.nodes[0]?.deviceId);
  const machine = w ?? device, os = machine?.os, stats = c.vm ? vmStats(game, c.vm) : null;
  const ring = stats?.ring.map((x) => x.cpu) ?? [], vcpu = w?.vcpu ?? 1;
  let cpu = 0, ram = 0, dsk = 0;
  if (stats) { cpu = stats.now.cpu; ram = stats.now.ram; dsk = stats.now.disk; } else if (device) {
    const u = nodeUsage(game, device.id);
    cpu = u.physical.vcpu ? u.used.vcpu / u.physical.vcpu : 0; ram = u.physical.ramGb ? u.used.ramGb / u.physical.ramGb : 0; dsk = u.physical.diskGb ? u.used.diskGb / u.physical.diskGb : 0;
  }
  const load = [1, 5, 15].map((n) => (ring.length ? avg(ring.slice(-n)) : cpu) * vcpu), hours = stats?.uptimeHours ?? 0;
  const facts: Fact[] = [
    { label: t("readouts.si.host"), value: host },
    { label: t("readouts.si.os"), value: os ? imageName(imageOf(os.id, os.version)) : "" },
    { label: t("readouts.si.time"), value: formatClock(game.hour) },
    { label: t("readouts.si.uptime"), value: t("readouts.si.uptimeOf", { d: Math.floor(hours / 24), h: hours % 24 }) },
    { label: t("readouts.si.load"), value: load.map((x) => x.toFixed(2)).join(", "), num: true },
    { label: t("readouts.si.updates"), value: updateDue(game, c) ? t("readouts.si.updatesDue") : t("readouts.si.updatesNone") },
  ];
  return (
    <>
      <Facts facts={facts} />
      <table className="cx-table cx-facts">
        <tbody>
          <tr><th>{t("readouts.si.memory")}</th><td><Bar use={[ram, 1]} /><span className="cx-use num">{pct(ram)}</span></td></tr>
          <tr><th>{t("readouts.si.disk")}</th><td><Bar use={[dsk, 1]} /><span className="cx-use num">{pct(dsk)}</span></td></tr>
        </tbody>
      </table>
    </>
  );
}
