import type { ComponentType } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { familyOf } from "../../../../sim/60-infra/vulns";
import { panelLocked } from "../../../../sim/60-infra/licence";
import { consoleFeatures } from "../../../../sim/80-business/consoles";
import { t } from "../../../../i18n/en";
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
import { LicenceGate } from "./Readouts";
import "./consoles.css";

export const CONSOLES: Record<string, ComponentType<PanelProps>> = {
  cpanic: CPanic, pleskit: Pleskit, directadmen: DirectAdmen, freepanel: FreePanel, tcadmen: TCAdmen, multikraft: MultiKraft, pterodaktyl: Pterodaktyl,
  proxmocks: Proxmocks, vmwhere: VmWhere, hypervee: HyperVee, openveezee: OpenVeeZee, openstash: Horizont,
  powerdnz: PowerDnz, openveepeen: OpenVeePeeN, anyconnekt: AnyConnekt, ownclod: OwnClod, minnio: MinnIO, mailpig: Mailpig,
  veeham: BackupConsole, proxmocksBackup: BackupConsole,
};

function Defaced() {
  return (
    <div className="cx-defaced">
      <h1>{t("browser-consoles-1.defacedTitle")}</h1>
      <p>{t("browser-consoles-1.defacedBody")}</p>
    </div>
  );
}

export function ConsolePage({ game, hostname, host, cluster, defaced, path }: { game: GameState; hostname: string; host: string; cluster: Cluster | undefined; defaced: boolean; path?: string }) {
  const [logins, setLogins] = useSessionState<string[]>("browser.logins", []);
  const family = cluster && familyOf(cluster), Panel = family ? CONSOLES[family] : undefined;
  if (!cluster || !family) return null;
  if (CLI_ONLY.has(family)) return <HostCli game={game} c={cluster} family={family} host={host} name={hostname} />;
  if (defaced) return <Defaced />;
  if (!Panel) return null;
  if (logins.includes(hostname) && (cluster.setupPending || panelLocked(game, cluster))) return <LicenceGate game={game} c={cluster} host={host} />;
  return <Panel key={path ?? "/"} path={path} game={game} c={cluster} f={consoleFeatures(family, yearOf(game.hour))} host={host} signedIn={logins.includes(hostname)} login={() => setLogins([...logins, hostname])} logout={() => setLogins(logins.filter((x) => x !== hostname))} />;
}
