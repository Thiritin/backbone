// The server's own screen (docs/design/console.md): the BIOS setup a key during POST or at the firmware prompt opens,
// and the installer on the USB stick the boot menu starts. While a server sits in setup its boot waits, so its workloads
// stay down.
import { nowHours, yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { clustersOn, dropCluster, insideVm, isOwnVm, machineOf, setMachine, vmById, workloadsOn, type Cluster, type Workload } from "../60-infra/cluster";
import { imageOf, imageParts, nextVersion, SERVER_OS, serverOsById, type OsImage, type ServerOsId, type ServerOsVersion } from "../10-catalog/server-os";
import { machineNet, osUp, stickOs } from "../60-infra/oob";
import { pushLog } from "../60-infra/power";
import { BOOT_HOURS, bootHours, booting, powered } from "../60-infra/status";
import { buyLicenses, buyUpgradeLicense, licenseDue, reportLoss, upgradeLicenseDue } from "../85-products/products";
import { leave } from "./clusters";
import type { ActionResult } from "./hardware";
import { installSoftware, uninstallSoftware } from "./software";

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

// The boot menu's USB entry, there while the stick is in the server and written with an OS. The operating system on the disks is not running while the server is booted from the stick, so this is also the one way to erase it.
export function bootFromUsb(s: GameState, deviceId: string): ActionResult {
  const d = server(s, deviceId);
  if (typeof d === "string") return fail(d);
  if (d.setup) return fail("error.notAtPost");
  if (!stickOs(s, d.id)) return fail("error.noBootDevice");
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
  const cluster = clustersOn(s, machineId)[0];
  if (!cluster) return { kind: "empty" };
  const workloads = vm ? [] : workloadsOn(s, machineId);
  const lost = vm ? insideVm(s, machineId) : workloads.flatMap((w) => (isOwnVm(w) ? insideVm(s, w.id) : [w]));
  if (!workloads.length && !lost.length) return { kind: "idle", cluster };
  return { kind: "busy", cluster, workloads, lost };
}

// Erasing a machine with customers on it loses their data the way a dead array does: the same loss report, refund tickets
// and reputation hit. Their services end with it, since nothing is left to restore to. A VM's loss is booked on its host.
// ponytail: no restore from backup onto the reinstalled machine; add when a player asks for it.
function wipe(s: GameState, m: Machine, ws: Workload[], lost: Workload[]): void {
  const d = isDevice(m) ? m : s.devices.find((x) => x.id === m.deviceId);
  if (isDevice(m)) m.dataLost = s.hour;
  if (d) reportLoss(s, d, lost, s.hour, []);
  const gone = new Set([...ws, ...lost].map((w) => w.id)), services = new Set(lost.map((w) => w.serviceId));
  for (const nested of s.clusters.filter((x) => x.vm && gone.has(x.vm))) dropCluster(s, nested.id);
  s.workloads = s.workloads.filter((w) => !gone.has(w.id));
  s.services = s.services.map((v) => (services.has(v.id) && v.endedAt === null ? { ...v, endedAt: s.hour } : v));
  for (const c of clustersOn(s, m.id)) if (isDevice(m) && c.nodes.length > 1) leave(s, c.id, m.id); else dropCluster(s, c.id);
  if (isDevice(m)) pushLog(m, s.hour, "ipmi.log.erased");
}

// Clears the disks for the installer: software nobody uses goes quietly, software with customers on it needs the machine's
// hostname typed.
function clear(s: GameState, m: Machine, confirm: string | undefined): ActionResult {
  const c = installCase(s, m.id);
  if (c.kind === "empty") return { ok: true };
  if (c.kind === "idle") {
    for (const x of clustersOn(s, m.id)) { const r = uninstallSoftware(s, m.id, x.panel ?? x.platform ?? x.switching?.to); if (!r.ok) return r; }
    return { ok: true };
  }
  if (confirm !== hostOf(m)) return fail("error.confirmHostname");
  wipe(s, m, c.workloads, c.lost);
  return { ok: true };
}

// The machine booted into its installer: a server from the stick, a VM from the ISO, or why not.
const atInstaller = (s: GameState, machineId: string): Machine | string => {
  const vm = vmById(s, machineId);
  if (vm) return !isOwnVm(vm) ? "error.notOwnVm" : vm.stopped ? "error.alreadyStopped" : !vm.media ? "error.noMedia" : vm;
  const d = server(s, machineId);
  return typeof d === "string" ? d : d.bootFrom !== "usb" ? "error.notFromUsb" : !stickOs(s, d.id) ? "error.noBootDevice" : d;
};

// The installer's Install: whatever the disks held goes first, then the OS installs for its install hours, the version
// on the media. os.installedAt is the hour it is done; a server is held in its boot until then and boots from its disk
// after, a VM ejects its ISO. The stick and an ISO each hold one version of one OS.
export function installOs(s: GameState, machineId: string, osId: ServerOsId, confirm?: string): ActionResult {
  const m = atInstaller(s, machineId);
  if (typeof m === "string") return fail(m);
  if (!SERVER_OS.some((o) => o.id === osId)) return fail("error.unknownOs");
  const media = isDevice(m) ? stickOs(s, m.id) : m.media;
  if (!media || imageParts(media).id !== osId) return fail("error.otherMedia");
  // The Debiant image is a netinst; Windoors Setup carries everything on its image.
  const net = osId === "lunix" ? machineNet(s, machineId) : null;
  if (net) return fail(net === "noInterfaces" ? "error.noInterfaces" : "error.noAutoconf");
  if (s.cash < licenseDue(s, machineId, osId, null)) return fail("error.noCash");
  const cleared = clear(s, m, confirm);
  if (!cleared.ok) return cleared;
  const os = serverOsById(osId), done = nowHours(s) + os.installHours;
  setMachine(s, machineId, () => ({ os: { id: osId, version: imageParts(media).version, installedAt: done }, software: [] }));
  buyLicenses(s, machineId, osId, null);
  if (isDevice(m)) Object.assign(m, { bootFrom: "disk", stuck: false, bootUntil: done + BOOT_HOURS + os.bootMinutes / 60 });
  else s.workloads = s.workloads.map((w) => (w.id === machineId ? { ...w, media: undefined } : w));
  return { ok: true };
}

// docs/design/software.md, section 4.4: the release an in-place upgrade takes the machine to, the next one once it is out.
export const upgradeTarget = (s: GameState, machineId: string): ServerOsVersion | null => {
  const os = machineOf(s, machineId)?.os;
  return os && os.installedAt <= nowHours(s) ? nextVersion(os.id, os.version, yearOf(s.hour)) : null;
};
// Hours the machine is down for an upgrade: the OS's install hours and its boot, after POST on a server.
export const upgradeHours = (s: GameState, machineId: string): number => {
  const os = serverOsById(machineOf(s, machineId)!.os!.id);
  return os.installHours + os.bootMinutes / 60 + (s.devices.some((d) => d.id === machineId) ? BOOT_HOURS : 0);
};

// Upgrades the machine's OS in place to the next release, keeping its software: Debiant from its running shell over the
// network, Windoors from Setup on the next release's media. Everything still running on the machine is down for the
// upgrade and counts it against its SLA; what was migrated off first stays up.
export function upgradeOs(s: GameState, machineId: string): ActionResult {
  const m = machineOf(s, machineId);
  if (!m?.os) return fail(m ? "error.noSoftware" : "error.unknownDevice");
  const next = upgradeTarget(s, machineId);
  if (!next) return fail("error.noUpgrade");
  if (m.os.id === "lunix") {
    if (!osUp(s, machineId)) return fail("error.osNotUp");
    if (machineNet(s, machineId)) return fail("error.noDownload");
  } else {
    const at = atInstaller(s, machineId);
    if (typeof at === "string") return fail(at);
    if ((isDevice(at) ? stickOs(s, at.id) : at.media) !== imageOf(m.os.id, next.version)) return fail("error.otherMedia");
  }
  if (s.cash < upgradeLicenseDue(s, m.os.id)) return fail("error.noCash");
  const hours = upgradeHours(s, machineId), done = nowHours(s) + serverOsById(m.os.id).installHours, from = m.os.version;
  // What runs on the machine goes down with it; a VM's own console stays on and shows the upgrade.
  const found = installCase(s, machineId), down = found.kind === "busy" ? [...found.workloads, ...found.lost] : [];
  const ids = new Set(down.map((w) => w.id)), services = new Set(down.filter((w) => !isOwnVm(w)).map((w) => w.serviceId));
  s.workloads = s.workloads.map((w) => (ids.has(w.id) ? { ...w, busyUntil: Math.max(w.busyUntil, s.hour + hours) } : w));
  // The hourly tick counts every whole hour a workload is busy; the rest is added here, as for a software update.
  const rest = hours - (Math.ceil(hours) - 1);
  for (const id of services) s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + rest };
  buyUpgradeLicense(s, machineId, m.os.id, next.version);
  setMachine(s, machineId, (x) => ({ os: { ...x.os!, version: next.version, installedAt: done, from } }));
  if (isDevice(m)) {
    Object.assign(m, { bootFrom: "disk", stuck: false, bootUntil: nowHours(s) + hours });
    pushLog(m, s.hour, "ipmi.log.upgrade");
  } else s.workloads = s.workloads.map((w) => (w.id === machineId ? { ...w, media: undefined } : w));
  return { ok: true };
}

// Any key on the failure an abandoned install left on the console.
export function dismissInstallFail(s: GameState, machineId: string): ActionResult {
  if (!vmById(s, machineId) && !s.devices.some((d) => d.id === machineId)) return fail("error.unknownDevice");
  setMachine(s, machineId, () => ({ installFailed: undefined }));
  return { ok: true };
}

// Software whose installer comes from its website: Server Manager, Add or Remove Programs, apt and the script lines.
export function installFromSite(s: GameState, machineId: string, softwareId: string): ActionResult {
  return machineNet(s, machineId) ? fail("error.noDownload") : installSoftware(s, machineId, softwareId);
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
export function setMedia(s: GameState, vmId: string, media: OsImage | null): ActionResult {
  const vm = vmById(s, vmId);
  if (!vm || !isOwnVm(vm)) return fail("error.notOwnVm");
  if (media && !s.media.images.includes(media)) return fail("error.noImage");
  s.workloads = s.workloads.map((w) => (w.id === vmId ? { ...w, media: media ?? undefined } : w));
  return { ok: true };
}
