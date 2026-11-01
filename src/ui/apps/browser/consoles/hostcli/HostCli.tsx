import { installedVersion, panelMachine } from "../../../../../sim/60-infra/licence";
import { dateOf } from "../../../../../sim/00-core/time";
import { mailAddress } from "../../../../../sim/60-infra/addresses";
import { mailStateOf, spamSenders } from "../../../../../sim/60-infra/netsvc-mail";
import { companyDomain } from "../../../../../sim/30-customers/domains";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { t } from "../../../../../i18n/en";
import { HostPage } from "../../sites/Pages";
import { useMailQueue } from "../mailpig/MailQueue";
import { queueEntries } from "../../../../../sim/60-infra/netsvc-mail";
import { backupPool } from "../../../../../sim/85-products/products";
import { hash, tenants, wgKey, type Tenant } from "../services";
import { Restores } from "../backup/Restores";
import "./hostcli.css";

// docs/design/software.md, section 10: the software without a web console; its host page prints what the product's CLI would.
// The jobs that write to a repository and have run, oldest first.
export const finishedJobs = (game: GameState, targetId: string) =>
  game.clusters.flatMap((x) => x.jobs.filter((j) => j.targetId === targetId && j.lastRun !== null).map((j) => ({ name: `${x.name} ${j.name}`, last: j.lastRun!, ok: j.lastOk !== false }))).sort((a, b) => a.last - b.last);

export const CLI_ONLY = new Set(["bound", "knut", "wireguarded", "vsftpeed", "postfixit", "backula"]);

const serial = (game: GameState, zone: string) => {
  const d = dateOf(game.hour), ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `${ymd}${String(hash(zone) % 100).padStart(2, "0")}`;
};
const zonesOf = (ts: Tenant[]) => ts.flatMap((t) => t.zones);
const mib = (n: number) => `${(n / 100).toFixed(2)} MiB`;

// Postfix's mailq: one block per deferred mail with its reason, then the total.
function mailq(game: GameState, c: Cluster): string[] {
  const a = mailAddress(game, c.id), n = a ? mailStateOf(game, a.id).deferred : 0;
  const senders = a ? spamSenders(game, a.id).map((x) => `${String(x.thousands * 1000).padStart(8)} ${game.customers.find((k) => k.id === x.customerId)?.name ?? x.customerId}`) : [];
  const top = senders.length ? ["", `${t("netsvc.topSenders")}:`, ...senders] : [];
  if (!a || n === 0) return ["Mail queue is empty", ...top];
  const when = (h: number) => { const [wd, dd, mon, , time] = dateOf(h).toUTCString().replace(",", "").split(" "); return `${wd} ${mon} ${dd} ${time}`; };
  return [
    "-Queue ID-  --Size-- ----Arrival Time---- -Sender/Recipient-------",
    ...queueEntries(game, a.id).flatMap((e) => [`${e.id.padEnd(11)} ${String(e.bytes).padStart(8)} ${when(e.hour)}  ${e.sender}`, `(${e.reason})`, `${" ".repeat(41)}${e.recipient}`, ""]),
    `-- ${Math.ceil(n * 1.4)} Kbytes in ${n} Requests.`,
    ...top,
  ];
}

function listing(game: GameState, c: Cluster, family: string, name: string): [string, string[]][] {
  const ver = installedVersion(game, panelMachine(c) ?? "", family);
  const ts = tenants(game, c), zones = zonesOf(ts);
  switch (family) {
    case "bound": return [
      ["named-checkconf -z", zones.map((z) => `zone ${z}/IN: loaded serial ${serial(game, z)}`)],
      ["rndc status", [...(ver ? [`version: BOUND ${ver}`] : []), `number of zones: ${zones.length}`, "server is up and running"]],
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
    case "backula": {
      const pool = backupPool(game, c.id), stamp = (h: number) => dateOf(h).toISOString().slice(0, 16).replace("T", " ");
      const done = finishedJobs(game, c.id);
      return [
        ["echo 'status director' | bconsole", [
          ...(ver ? [`${name}-dir Version: ${ver}`] : []), "", "Terminated Jobs:",
          ...(done.length ? [" JobId  Level  Status  Finished          Name", ...done.map((j, i) => `${String(i + 1).padStart(6)}  Incr   ${j.ok ? "OK    " : "Error "}  ${stamp(j.last)}  ${j.name}`)] : ["No Terminated Jobs."]),
        ]],
        ["df -h /var/lib/backula", ["Filesystem  Size  Used  Avail  Mounted on", `/dev/sdb1   ${Math.round(pool.need + Math.max(0, pool.room))}G  ${Math.round(pool.need)}G  ${Math.round(Math.max(0, pool.room))}G  /var/lib/backula`]],
      ];
    }
    default: return [
      ["postconf myhostname mydomain", [`myhostname = ${name}.${companyDomain(game)}`, `mydomain = ${companyDomain(game)}`]],
      ["mailq", mailq(game, c)],
    ];
  }
}

export function HostCli({ game, c, family, host, name }: { game: GameState; c: Cluster; family: string; host: string; name: string }) {
  const q = useMailQueue(game, c.id);
  return (
    <HostPage host={host}>
      <pre className="hc">
        {listing(game, c, family, name).map(([cmd, out]) => `root@${name}:~# ${cmd}\n${out.map((l) => `${l}\n`).join("")}`).join("")}
        {`root@${name}:~# `}
      </pre>
      {family === "backula" && <div className="hc-actions"><Restores game={game} c={c} /></div>}
      {family === "postfixit" && <div className="hc-actions"><button className="cx-btn" onClick={q.flush}>postqueue -f</button><button className="cx-btn" onClick={q.clear}>postsuper -d ALL deferred</button></div>}
    </HostPage>
  );
}
