import { dateOf } from "../../../../../sim/00-core/time";
import { companyDomain } from "../../../../../sim/30-customers/domains";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { HostPage } from "../../sites/Pages";
import { hash, tenants, wgKey, type Tenant } from "../services";
import "./hostcli.css";

// docs/design/software.md, section 10: the software without a web console; its host page prints what the product's CLI would.
export const CLI_ONLY = new Set(["bound", "knut", "wireguarded", "vsftpeed", "postfixit"]);

const serial = (game: GameState, zone: string) => {
  const d = dateOf(game.hour), ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${ymd}${String(hash(zone) % 100).padStart(2, "0")}`;
};
const zonesOf = (ts: Tenant[]) => ts.flatMap((t) => t.zones);
const mib = (n: number) => `${(n / 100).toFixed(2)} MiB`;

function listing(game: GameState, c: Cluster, family: string, name: string): [string, string[]][] {
  const ts = tenants(game, c), zones = zonesOf(ts);
  switch (family) {
    case "bound": return [
      ["named-checkconf -z", zones.map((z) => `zone ${z}/IN: loaded serial ${serial(game, z)}`)],
      ["rndc status", [`version: BOUND ${c.version}`, `number of zones: ${zones.length}`, "server is up and running"]],
    ];
    case "knut": return [
      ["knotc status", ["Running"]],
      ["knotc zone-status", zones.map((z) => `[${z}.] role: master | serial: ${serial(game, z)}`)],
    ];
    case "wireguarded": {
      const peers = ts.flatMap((t) => Array.from({ length: t.users }, (_, i) => ({ id: `${t.id}:${i}`, on: t.running })));
      return [["wg show", [
        "interface: wg0", `  public key: ${wgKey(c.id)}`, "  private key: (hidden)", "  listening port: 51820",
        ...peers.flatMap((p, i) => ["", `peer: ${wgKey(p.id)}`, `  allowed ips: 10.8.${i >> 8}.${(i % 254) + 2}/32`,
          ...(p.on ? [`  latest handshake: ${hash(p.id) % 110 + 5} seconds ago`, `  transfer: ${mib(hash(`${p.id}r`) % 90000)} received, ${mib(hash(`${p.id}s`) % 900000)} sent`] : [])]),
      ]]];
    }
    case "vsftpeed": {
      const d = dateOf(game.hour).toUTCString().replace(",", "");
      const lines = ts.filter((t) => t.running).flatMap((t) => {
        const pid = `[pid ${hash(t.id) % 30000 + 1000}]`, ip = `"10.0.${hash(t.id) % 250}.${hash(`${t.id}ip`) % 250 + 2}"`;
        return [`${d} ${pid} CONNECT: Client ${ip}`, `${d} ${pid} [${t.hostname}] OK LOGIN: Client ${ip}`,
          `${d} ${pid} [${t.hostname}] OK UPLOAD: Client ${ip}, "/backup/${t.hostname}.tar.gz", ${hash(`${t.id}b`) % 900_000_000 + 1_000_000} bytes`];
      });
      return [["tail -n 10 /var/log/vsftpeed.log", lines.slice(-10)]];
    }
    default: return [
      ["postconf myhostname mydomain", [`myhostname = ${name}.${companyDomain(game)}`, `mydomain = ${companyDomain(game)}`]],
      ["mailq", ["Mail queue is empty"]],
    ];
  }
}

export function HostCli({ game, c, family, host, name }: { game: GameState; c: Cluster; family: string; host: string; name: string }) {
  return (
    <HostPage host={host}>
      <pre className="hc">
        {listing(game, c, family, name).map(([cmd, out]) => `root@${name}:~# ${cmd}\n${out.map((l) => `${l}\n`).join("")}`).join("")}
        {`root@${name}:~# `}
      </pre>
    </HostPage>
  );
}
