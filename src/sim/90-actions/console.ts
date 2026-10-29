// The server's own screen (docs/design/console.md): the BIOS setup a key during POST or at the firmware prompt opens,
// and the installer on the USB stick the boot menu starts. While a server sits in setup its boot waits, so its workloads
// stay down.
import { nowHours } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { clusterOf, dropCluster, hostOfVm, isOwnVm, workloadsOn, type Cluster, type Workload } from "../60-infra/cluster";
import { pushLog } from "../60-infra/power";
import { BOOT_HOURS, booting, powered } from "../60-infra/status";
import { reportLoss } from "../85-products/products";
import { leave } from "./clusters";
import type { ActionResult } from "./hardware";
import { installSoftware, uninstallSoftware } from "./software";

const fail = (error: string): ActionResult => ({ ok: false, error });
const hostOf = (d: Device) => d.hostname ?? d.label ?? d.name;

const server = (s: GameState, deviceId: string): Device | string => {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return "error.unknownDevice";
  if (modelById(d.model).kind !== "server") return "error.notServer";
  if (!d.on || !powered(s, d.id)) return "error.serverOff";
  return d;
};

// Del during POST, or at the firmware prompt a stuck boot waits at. The key counts for the whole boot, which is the time
// the console shows the splash.
export function enterSetup(s: GameState, deviceId: string): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (d.setup) return { ok: true };
  if (!booting(s, d) && !d.stuck) return fail("error.notAtPost");
  d.setup = true;
  d.stuck = false;
  pushLog(d, s.hour, "ipmi.log.setup");
  return { ok: true };
}

// Leaving setup, saved or discarded, lets the boot run on; every setting applied on the spot.
export function exitSetup(s: GameState, deviceId: string): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.setup) return fail("error.notInSetup");
  d.setup = false;
  d.bootUntil = nowHours(s) + BOOT_HOURS;
  pushLog(d, s.hour, "ipmi.log.setupLeft");
  return { ok: true };
}

// The boot menu's USB entry: the stick always holds the installer with the whole catalog on it. The operating system on
// the disks is not running while the server is booted from the stick, so this is also the one way to erase it.
export function bootFromUsb(s: GameState, deviceId: string): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (d.setup) return fail("error.notAtPost");
  d.bootFrom = "usb";
  d.stuck = false;
  pushLog(d, s.hour, "ipmi.log.usbBoot");
  return { ok: true };
}

// What the installer finds on the disks: nothing, software nobody uses, or software with customers on it. workloads is
// what sits on the server, lost what dies with it: the customers' workloads, those inside the player's own VMs included.
export type InstallCase = { kind: "empty" } | { kind: "idle"; cluster: Cluster } | { kind: "busy"; cluster: Cluster; workloads: Workload[]; lost: Workload[] };
export function installCase(s: GameState, deviceId: string): InstallCase {
  const cluster = clusterOf(s, deviceId);
  if (!cluster) return { kind: "empty" };
  const workloads = workloadsOn(s, deviceId);
  if (!workloads.length) return { kind: "idle", cluster };
  const lost = workloads.flatMap((w) => (isOwnVm(w) ? s.workloads.filter((x) => x.clusterId === hostOfVm(s, w.id)?.id) : [w]));
  return { kind: "busy", cluster, workloads, lost };
}

// Erasing a server with customers on it loses their data the way a dead array does: the same loss report, refund tickets
// and reputation hit. Their services end with it, since nothing is left to restore to.
// ponytail: no restore from backup onto the reinstalled server; add when a player asks for it.
function wipe(s: GameState, d: Device, c: Cluster, ws: Workload[], lost: Workload[]): void {
  d.dataLost = s.hour;
  reportLoss(s, d, lost, s.hour, []);
  const gone = new Set([...ws, ...lost].map((w) => w.id)), services = new Set(lost.map((w) => w.serviceId));
  for (const nested of s.clusters.filter((x) => x.vm && gone.has(x.vm))) dropCluster(s, nested.id);
  s.workloads = s.workloads.filter((w) => !gone.has(w.id));
  s.services = s.services.map((v) => (services.has(v.id) && v.endedAt === null ? { ...v, endedAt: s.hour } : v));
  if (c.nodes.length > 1) leave(s, c.id, d.id); else dropCluster(s, c.id);
  pushLog(d, s.hour, "ipmi.log.erased");
}

// Clears the disks for the installer: software nobody uses goes quietly, software with customers on it needs the server's
// hostname typed. Returns what to put back when the install that follows is refused.
function clear(s: GameState, d: Device, confirm: string | undefined): ActionResult {
  const c = installCase(s, d.id);
  if (c.kind === "empty") return { ok: true };
  if (c.kind === "idle") return uninstallSoftware(s, d.id);
  if (confirm !== hostOf(d)) return fail("error.confirmHostname");
  wipe(s, d, c.cluster, c.workloads, c.lost);
  return { ok: true };
}

const snapshot = (s: GameState, d: Device) => ({ clusters: s.clusters, workloads: s.workloads, services: s.services, company: s.company, security: s.security, lossReports: s.lossReports, tickets: s.tickets, customers: s.customers, nextId: s.nextId, dataLost: d.dataLost, log: d.log });
const restore = (s: GameState, d: Device, snap: ReturnType<typeof snapshot>) => { const { dataLost, log, ...rest } = snap; Object.assign(s, rest); Object.assign(d, { dataLost, log }); };

// The installer's Install: whatever the disks held goes first, then the software installs as from the catalog.
export function installFromUsb(s: GameState, deviceId: string, softwareId: string, confirm?: string): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (d.bootFrom !== "usb") return fail("error.notFromUsb");
  const snap = snapshot(s, d), cleared = clear(s, d, confirm);
  if (!cleared.ok) return cleared;
  const r = installSoftware(s, deviceId, softwareId);
  if (!r.ok) restore(s, d, snap);
  return r;
}

// The installer's Erase disk: bare metal again, under the same confirmation as a reinstall.
export function eraseDisk(s: GameState, deviceId: string, confirm?: string): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (d.bootFrom !== "usb") return fail("error.notFromUsb");
  if (installCase(s, deviceId).kind === "empty") return fail("error.noSoftware");
  return clear(s, d, confirm);
}
