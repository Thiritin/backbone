// Which own mail server a typed host name or address reaches: its machine's names, or whatever the company zone resolves
// the name to when that is the server's mail address or LAN address.
import { nowHours } from "../00-core/time";
import { fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { machineAddress, mailAddress } from "./addresses";
import { machineOf, type Cluster } from "./cluster";
import { addressesAt } from "./company-zone";
import { panelMachine } from "./licence";
import { isIpv4 } from "./netsvc-dns";

export const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

// Every name a machine answers to: its hostname, its fqdn once the company has a domain, and its address.
export function namesOf(s: GameState, id: string): string[] {
  const host = machineOf(s, id)?.hostname, ip = machineAddress(s, id);
  return [...(host ? [host, ...(s.company.domain ? [fqdn(s, host)] : [])] : []), ...(ip ? [ip] : [])];
}

// The own mail server a host reaches; localhost means the server on the machine `from`.
export function mailClusterAtHost(s: GameState, host: string, from?: string | null): Cluster | null {
  const name = host.trim().toLowerCase().replace(/\.$/, "");
  if (!name) return null;
  const ips = isIpv4(name) ? [name] : addressesAt(s, name, nowHours(s));
  return s.clusters.find((c) => {
    const id = c.kind === "mail" ? panelMachine(c) : null;
    if (!id) return false;
    if (LOCAL_HOSTS.includes(name)) return id === from;
    const ip = mailAddress(s, c.id)?.ip;
    return namesOf(s, id).includes(name) || (!!ip && ips.includes(ip));
  }) ?? null;
}
