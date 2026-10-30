// The server's own screen (docs/design/console.md): the BIOS setup a key during POST or at the firmware prompt opens,
// and the installer on the USB stick the boot menu starts. While a server sits in setup its boot waits, so its workloads
// stay down.
import { nowHours, yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { clusterOf, dropCluster, hostOfVm, isOwnVm, setMachine, vmById, workloadsOn, type Cluster, type Workload } from "../60-infra/cluster";
import { SERVER_OS, serverOsAt, serverOsById, type ServerOsId } from "../10-catalog/server-os";
import { pushLog } from "../60-infra/power";
import { BOOT_HOURS, bootHours, booting, powered } from "../60-infra/status";
import { buyLicenses, licenseDue, reportLoss } from "../85-products/products";
import { leave } from "./clusters";
import type { ActionResult } from "./hardware";
import { uninstallSoftware } from "./software";

const fail = (error: string): ActionResult => ({ ok: false, error });
// A machine is a server or one of the player's own VMs; a VM has no label, so its hostname is the vmNNN it got at birth.
type Machine = Device | Workload;
const isDevice = (m: Machine): m is Device => "components" in m;
const hostOf = (m: Machine) => (isDevice(m) ? m.hostname ?? m.label ?? m.name : m.hostname ?? m.id);

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
  if ((!booting(s, d) && !d.stuck) || (d.os && d.os.installedAt > nowHours(s))) return fail("error.notAtPost");
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
  d.bootUntil = nowHours(s) + bootHours(s, d);
  pushLog(d, s.hour, "ipmi.log.setupLeft");
  return { ok: true };
}

// The boot menu's USB entry: the stick holds the installers of both operating systems. The operating system on the disks is not running while the server is booted from the stick, so this is also the one way to erase it.
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
// what sits on the server (nothing for a VM), lost what dies with it: the customers' workloads, those inside the player's
// own VMs included.
export type InstallCase = { kind: "empty" } | { kind: "idle"; cluster: Cluster } | { kind: "busy"; cluster: Cluster; workloads: Workload[]; lost: Workload[] };
export function installCase(s: GameState, machineId: string): InstallCase {
  const vm = !s.devices.some((d) => d.id === machineId);
  const cluster = vm ? hostOfVm(s, machineId) : clusterOf(s, machineId);
  if (!cluster) return { kind: "empty" };
  const workloads = vm ? [] : workloadsOn(s, machineId);
  const lost = vm ? s.workloads.filter((w) => w.clusterId === cluster.id) : workloads.flatMap((w) => (isOwnVm(w) ? s.workloads.filter((x) => x.clusterId === hostOfVm(s, w.id)?.id) : [w]));
  if (!workloads.length && !lost.length) return { kind: "idle", cluster };
  return { kind: "busy", cluster, workloads, lost };
}

// Erasing a machine with customers on it loses their data the way a dead array does: the same loss report, refund tickets
// and reputation hit. Their services end with it, since nothing is left to restore to. A VM's loss is booked on its host.
// ponytail: no restore from backup onto the reinstalled machine; add when a player asks for it.
function wipe(s: GameState, m: Machine, c: Cluster, ws: Workload[], lost: Workload[]): void {
  const d = isDevice(m) ? m : s.devices.find((x) => x.id === m.deviceId);
  if (isDevice(m)) m.dataLost = s.hour;
  if (d) reportLoss(s, d, lost, s.hour, []);
  const gone = new Set([...ws, ...lost].map((w) => w.id)), services = new Set(lost.map((w) => w.serviceId));
  for (const nested of s.clusters.filter((x) => x.vm && gone.has(x.vm))) dropCluster(s, nested.id);
  s.workloads = s.workloads.filter((w) => !gone.has(w.id));
  s.services = s.services.map((v) => (services.has(v.id) && v.endedAt === null ? { ...v, endedAt: s.hour } : v));
  if (isDevice(m) && c.nodes.length > 1) leave(s, c.id, m.id); else dropCluster(s, c.id);
  if (isDevice(m)) pushLog(m, s.hour, "ipmi.log.erased");
}

// Clears the disks for the installer: software nobody uses goes quietly, software with customers on it needs the machine's
// hostname typed.
function clear(s: GameState, m: Machine, confirm: string | undefined): ActionResult {
  const c = installCase(s, m.id);
  if (c.kind === "empty") return { ok: true };
  if (c.kind === "idle") return uninstallSoftware(s, m.id);
  if (confirm !== hostOf(m)) return fail("error.confirmHostname");
  wipe(s, m, c.cluster, c.workloads, c.lost);
  return { ok: true };
}

// The machine booted into its installer: a server from the stick, a VM from the ISO, or why not.
const atInstaller = (s: GameState, machineId: string): Machine | string => {
  const vm = vmById(s, machineId);
  if (vm) return !isOwnVm(vm) ? "error.notOwnVm" : vm.stopped ? "error.alreadyStopped" : !vm.media ? "error.noMedia" : vm;
  const d = server(s, machineId);
  return typeof d === "string" ? d : d.bootFrom !== "usb" ? "error.notFromUsb" : d;
};

// The installer's Install: whatever the disks held goes first, then the OS installs for its install hours, the newest
// version of the year. os.installedAt is the hour it is done; a server is held in its boot until then and boots from its
// disk after, a VM ejects its ISO. The stick holds both operating systems, an ISO the one it is of.
export function installOs(s: GameState, machineId: string, osId: ServerOsId, confirm?: string): ActionResult {
  const m = atInstaller(s, machineId);
  if (typeof m === "string") return fail(m);
  if (!SERVER_OS.some((o) => o.id === osId)) return fail("error.unknownOs");
  if (!isDevice(m) && m.media !== osId) return fail("error.otherMedia");
  if (s.cash < licenseDue(s, machineId, osId, null)) return fail("error.noCash");
  const cleared = clear(s, m, confirm);
  if (!cleared.ok) return cleared;
  const os = serverOsById(osId), done = nowHours(s) + os.installHours;
  setMachine(s, machineId, () => ({ os: { id: osId, version: serverOsAt(osId, yearOf(s.hour)).version, installedAt: done }, software: [] }));
  buyLicenses(s, machineId, osId, null);
  if (isDevice(m)) Object.assign(m, { bootFrom: "disk", stuck: false, bootUntil: done + BOOT_HOURS + os.bootMinutes / 60 });
  else s.workloads = s.workloads.map((w) => (w.id === machineId ? { ...w, media: undefined } : w));
  return { ok: true };
}

// The installer's Erase disk: bare metal, or an empty VM, under the same confirmation as a reinstall.
export function eraseDisk(s: GameState, machineId: string, confirm?: string): ActionResult {
  const m = atInstaller(s, machineId);
  if (typeof m === "string") return fail(m);
  if (installCase(s, machineId).kind === "empty" && !m.os) return fail("error.noSoftware");
  const cleared = clear(s, m, confirm);
  if (cleared.ok) setMachine(s, machineId, () => ({ os: null, software: [] }));
  return cleared;
}

// The ISO of an OS in one of the player's own VMs: loaded, the VM boots its installer; ejected, or once the installer
// starts, its own disk again. A VM has no BIOS and no boot menu, the media decides.
export function setMedia(s: GameState, vmId: string, media: ServerOsId | null): ActionResult {
  const vm = vmById(s, vmId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  s.workloads = s.workloads.map((w) => (w.id === vmId ? { ...w, media: media ?? undefined } : w));
  return { ok: true };
}
