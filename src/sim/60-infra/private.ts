// gdd.md, Network and DDoS, Private networks: a customer's private network is a VLAN on the player's switches. The
// customer's VMs reach each other while every server they run on reaches the others with frames tagged in that VLAN.
import { isManaged, isOobPort, jacksOf, modelById } from "../10-catalog/hardware";
import type { End, GameState, PrivateNet } from "../50-state";
import type { Workload } from "./cluster";
import { isVm } from "./lan";
import { customerWorkloads, peerOf, serviceById, sweepMemo, working } from "./status";
import { egress, ingress, PRIVATE_VLAN_FROM, VLAN_MAX } from "./switches";

export const privateNetOf = (s: GameState, customerId: string): PrivateNet | undefined => s.privateNets.find((n) => n.customerId === customerId);

// The lowest VLAN no other private network uses; null once the switch domain's 4,094 are taken.
export function nextPrivateVlan(s: GameState): number | null {
  const used = new Set(s.privateNets.map((n) => n.vlan));
  for (let v = PRIVATE_VLAN_FROM; v <= VLAN_MAX; v++) if (!used.has(v)) return v;
  return null;
}

// The servers a frame tagged with vlan reaches from a server's data ports. Managed switches pass it between ports that
// carry the VLAN tagged, unmanaged ones pass it on untouched, and a server takes it only tagged.
export function vlanReach(s: GameState, from: string, vlan: number): Set<string> {
  const found = new Set([from]), seen = new Set<string>();
  const start = s.devices.find((d) => d.id === from);
  const queue: End[] = start ? modelById(start.model).ports.flatMap((_, port) => {
    const p = isOobPort(port) ? null : peerOf(s, { device: from, port });
    return p && !isOobPort(p.port) ? [p] : [];
  }) : [];
  while (queue.length) {
    const at = queue.shift()!, d = s.devices.find((x) => x.id === at.device);
    if (!d || seen.has(`${at.device}:${at.port}`)) continue;
    seen.add(`${at.device}:${at.port}`);
    const m = modelById(d.model);
    if (m.kind === "server") { found.add(d.id); continue; }
    if (m.kind !== "patch" && (m.kind !== "switch" || !working(s, d.id))) continue;
    if (isManaged(m) && ingress(d, at.port, vlan) !== vlan) continue;
    const exits = m.kind === "patch" ? [at.port < jacksOf(m) ? at.port + jacksOf(m) : at.port - jacksOf(m)] : m.ports.map((_, i) => i).filter((i) => i !== at.port);
    for (const port of exits) {
      const p = peerOf(s, { device: d.id, port });
      if (p && !isOobPort(p.port) && (!isManaged(m) || egress(d, port, vlan) === vlan)) queue.push(p);
    }
  }
  return found;
}

// The servers that run a customer's VMs.
export const privateNetHosts = (s: GameState, customerId: string): string[] =>
  [...new Set(customerWorkloads(s, customerId).filter((w) => w.deviceId && isVm(s, w) && serviceById(s, w.serviceId)?.customerId === customerId).map((w) => w.deviceId!))];

// Whether every server of the customer's VMs reaches the others in the network's VLAN; VMs on one server always do.
export function privateNetUp(s: GameState, net: PrivateNet): boolean {
  return sweepMemo(s, `private:${net.customerId}`, () => {
    const hosts = privateNetHosts(s, net.customerId);
    if (hosts.length < 2) return true;
    const reach = vlanReach(s, hosts[0], net.vlan);
    return hosts.every((h) => reach.has(h));
  });
}

// A customer's VM whose private network is cut.
export function privateNetDown(s: GameState, w: Workload): boolean {
  const customerId = w.serviceId ? serviceById(s, w.serviceId)?.customerId : undefined, net = customerId && privateNetOf(s, customerId);
  return !!net && !privateNetUp(s, net);
}
