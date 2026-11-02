import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { webspaceOf } from "../../../../sim/60-infra/webspace";
import { FileManager } from "./cpanic/FileManager";
import { MySqlDatabases } from "./cpanic/MySqlDatabases";
import { DomainPage, type DomainPageId } from "./cpanic/Domains";
import { isMailFtpPage, MailFtp, type MailFtpPage } from "./cpanic/MailFtp";
import { LogPage } from "./Readouts";
import { Softaculus } from "./cpanic/Softaculus";

export type ToolId = "files" | "db" | "access" | "errors" | "apps" | DomainPageId | MailFtpPage;

// One web space tool, worded by the panel's LookContext; every panel's customer side opens its pages through this.
export function WebTool({ game, c, workloadId, page }: { game: GameState; c: Cluster; workloadId: string; page: ToolId }) {
  const ws = webspaceOf(game, workloadId);
  if (!ws) return null;
  if (page === "files") return <FileManager game={game} c={c} workloadId={workloadId} />;
  if (isMailFtpPage(page)) return <MailFtp game={game} ws={ws} page={page} />;
  if (page === "db") return <MySqlDatabases game={game} workloadId={workloadId} />;
  if (page === "apps") return <Softaculus game={game} workloadId={workloadId} />;
  if (page === "access" || page === "errors") return <LogPage game={game} c={c} only={page === "errors" ? "error" : "access"} />;
  return <DomainPage game={game} c={c} workloadId={workloadId} page={page} />;
}
