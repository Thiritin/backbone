// docs/design/lan.md, Unmanaged and managed switches: VLAN forwarding and the running and saved configuration.
import { isManaged, modelById } from "../10-catalog/hardware";
import type { Device, PortVlan } from "../50-state";

// The VLAN a managed switch answers on; the player reaches its web interface through a port that carries it.
export const MGMT_VLAN = 1;
export const VLAN_MAX = 4094;
// Customer private networks take VLANs from here up; a port set to carry them all takes every one of them tagged.
export const PRIVATE_VLAN_FROM = 100;
const DEFAULT_VLAN: PortVlan = { untagged: MGMT_VLAN, tagged: [] };

// Where a managed switch answers when no DHCP server gives it an address.
export const FACTORY_IP: Record<string, string> = {
  Sysko: "192.168.1.254", "Hewlett-Packet": "192.168.2.10", Nettgear: "192.168.0.239", "D-Lunk": "10.90.90.90",
  MicroTick: "192.168.88.1", Ubiquitea: "192.168.1.20", Junipurr: "192.168.1.1", Aristotle: "192.168.1.10",
};

export const vlanOf = (d: Device, port: number): PortVlan => d.vlans?.[port] ?? DEFAULT_VLAN;
// Every VLAN the switch's ports use, VLAN 1 always.
export const vlansIn = (d: Device): number[] =>
  [...new Set([MGMT_VLAN, ...Object.values(d.vlans ?? {}).flatMap((v) => [v.untagged, ...v.tagged])])].sort((a, b) => a - b);

// A frame on a cable carries a tag (a VLAN) or none (null). A managed switch puts an untagged frame into the port's
// untagged VLAN and accepts a tagged one only on a port that carries that VLAN tagged (ingress, undefined when dropped);
// it sends a frame out of a port in its VLAN, untagged where that is the port's untagged VLAN (egress, the tag it leaves
// with, undefined when the port is not in the VLAN).
const carries = (v: PortVlan, vlan: number) => v.tagged.includes(vlan) || (!!v.all && vlan >= PRIVATE_VLAN_FROM);
export const ingress = (d: Device, port: number, tag: number | null): number | undefined => {
  const v = vlanOf(d, port);
  return tag === null ? v.untagged : tag !== v.untagged && carries(v, tag) ? tag : undefined;
};
export const egress = (d: Device, port: number, vlan: number): number | null | undefined => {
  const v = vlanOf(d, port);
  return v.untagged === vlan ? null : carries(v, vlan) ? vlan : undefined;
};
// The VLANs a frame in vlan can leave a switch in: every routed VLAN on a layer 3 switch that routes it, else its own.
export const routesTo = (d: Device, vlan: number): number[] =>
  modelById(d.model).layer === 3 && d.routed?.includes(vlan) ? d.routed : [vlan];
// A reboot drops what was not saved.
export function loadSaved(d: Device): void {
  if (!d.saved) return;
  d.groups = d.saved.groups.map((g) => [...g]);
  d.vlans = structuredClone(d.saved.vlans);
  if (d.routed || d.saved.routed) d.routed = [...(d.saved.routed ?? [])];
}

// The address a managed switch answers on: its factory address until it gets a lease.
export const switchIp = (d: Device): string | null => (d.rackId && isManaged(modelById(d.model)) ? FACTORY_IP[d.brand] ?? FACTORY_IP.Sysko : null);
