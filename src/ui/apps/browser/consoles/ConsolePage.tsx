import type { ComponentType } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { familyOf } from "../../../../sim/60-infra/vulns";
import { consoleFeatures } from "../../../../sim/80-business/consoles";
import { useSessionState } from "../../../session";
import { CPanic } from "./cpanic/CPanic";
import { DirectAdmen } from "./directadmen/DirectAdmen";
import { FreePanel } from "./freepanel/FreePanel";
import { MultiKraft } from "./multikraft/MultiKraft";
import type { PanelProps } from "./PanelBase";
import { Pleskit } from "./pleskit/Pleskit";
import { Proxmocks } from "./proxmocks/Proxmocks";
import { HyperVee } from "./hypervee/HyperVee";
import { Horizont } from "./openstash/Horizont";
import { OpenVeeZee } from "./openveezee/OpenVeeZee";
import { VmWhere } from "./vmwhere/VmWhere";
import { Pterodaktyl } from "./pterodaktyl/Pterodaktyl";
import { TCAdmen } from "./tcadmen/TCAdmen";
import { AnyConnekt } from "./anyconnekt/AnyConnekt";
import { BackupConsole } from "./backup/BackupConsole";
import { CLI_ONLY, HostCli } from "./hostcli/HostCli";
import { Mailpig } from "./mailpig/Mailpig";
import { MinnIO } from "./minnio/MinnIO";
import { OpenVeePeeN } from "./openveepeen/OpenVeePeeN";
import { OwnClod } from "./ownclod/OwnClod";
import { PowerDnz } from "./powerdnz/PowerDnz";
import "./consoles.css";

export const CONSOLES: Record<string, ComponentType<PanelProps>> = {
  cpanic: CPanic, pleskit: Pleskit, directadmen: DirectAdmen, freepanel: FreePanel, tcadmen: TCAdmen, multikraft: MultiKraft, pterodaktyl: Pterodaktyl,
  proxmocks: Proxmocks, vmwhere: VmWhere, hypervee: HyperVee, openveezee: OpenVeeZee, openstash: Horizont,
  powerdnz: PowerDnz, openveepeen: OpenVeePeeN, anyconnekt: AnyConnekt, ownclod: OwnClod, minnio: MinnIO, mailpig: Mailpig,
  backula: BackupConsole, veeham: BackupConsole, proxmocksBackup: BackupConsole,
};

function Defaced() {
  return (
    <div className="cx-defaced">
      <h1>Hacked by xX_Pwn3r_Xx</h1>
      <p>Greetings to everyone with a weak password.</p>
    </div>
  );
}

export function ConsolePage({ game, hostname, host, cluster, defaced }: { game: GameState; hostname: string; host: string; cluster: Cluster | undefined; defaced: boolean }) {
  const [logins, setLogins] = useSessionState<string[]>("browser.logins", []);
  const family = cluster && familyOf(cluster), Panel = family ? CONSOLES[family] : undefined;
  if (!cluster || !family) return null;
  if (CLI_ONLY.has(family)) return <HostCli game={game} c={cluster} family={family} host={host} name={hostname} />;
  if (defaced) return <Defaced />;
  if (!Panel) return null;
  return <Panel game={game} c={cluster} f={consoleFeatures(family, yearOf(game.hour))} host={host} signedIn={logins.includes(hostname)} login={() => setLogins([...logins, hostname])} logout={() => setLogins(logins.filter((x) => x !== hostname))} />;
}
