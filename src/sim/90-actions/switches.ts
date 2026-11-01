// Managed switch settings from its web interface (docs/design/lan.md, Unmanaged and managed switches). Port groups go
// through setPortGroup in hardware.ts.
import { isManaged, modelById } from "../10-catalog/hardware";
import type { Device, GameState, PortVlan } from "../50-state";
import { pushLog } from "../60-infra/power";
import { mgmtReachesGateway } from "../60-infra/status";
import { VLAN_MAX } from "../60-infra/switches";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

function managed(s: GameState, id: string): Device | string {
  const d = s.devices.find((x) => x.id === id);
  if (!d) return "error.unknownDevice";
  const m = modelById(d.model);
  if (m.kind !== "switch") return "error.notSwitch";
  if (!isManaged(m)) return "error.unmanaged";
  if (d.locked) return "error.lockedOut";
  return d;
}

// Sets a port's untagged VLAN and the VLANs it carries tagged, in the running configuration. A change that cuts the
// management VLAN off from the gateway, the way the desk comes in, locks the player out at once.
export function setPortVlan(s: GameState, switchId: string, port: number, vlan: PortVlan): ActionResult {
  const d = managed(s, switchId);
  if (typeof d === "string") return fail(d);
  if (!Number.isInteger(port) || !modelById(d.model).ports[port]) return fail("error.unknownPort");
  const ids = [vlan.untagged, ...vlan.tagged];
  if (ids.some((v) => !Number.isInteger(v) || v < 1 || v > VLAN_MAX)) return fail("error.vlanRange");
  const reached = mgmtReachesGateway(s, d);
  const next = { untagged: vlan.untagged, tagged: [...new Set(vlan.tagged)].filter((v) => v !== vlan.untagged).sort((a, b) => a - b) };
  d.vlans = { ...d.vlans, [port]: next };
  if (reached && !mgmtReachesGateway(s, d)) {
    d.locked = true;
    pushLog(d, s.hour, "ipmi.log.lockedOut");
  }
  return { ok: true };
}

// Copies the running configuration to the one the switch boots with.
export function saveSwitchConfig(s: GameState, switchId: string): ActionResult {
  const d = managed(s, switchId);
  if (typeof d === "string") return fail(d);
  d.saved = { groups: d.groups.map((g) => [...g]), vlans: structuredClone(d.vlans ?? {}) };
  return { ok: true };
}
