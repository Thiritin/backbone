import { Database, Folder, ScrollText, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { APP_NAME } from "../../../../../sim/10-catalog/apps";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { yearOf } from "../../../../../sim/00-core/time";
import { accountUse } from "../../../../../sim/80-business/readouts";
import { webspaceOf } from "../../../../../sim/60-infra/webspace";
import { disk } from "../../../hw";
import { Bar } from "../PanelBase";
import { domainTiles } from "./Domains";
import { mailFtpIcons } from "./MailFtp";
import { WebTool, type ToolId as Page } from "../WebTool";

const ICONS: [Page | "pma", string, LucideIcon][] = [
  ["files", "readouts.cp.files", Folder],
  ["db", "webdb.title", Database], ["pma", "webdb.pma.app", Database], ["access", "readouts.cp.access", ScrollText], ["errors", "readouts.cp.errors", TriangleAlert],
];

// The customer side of a cPanic account: read-only pages built from the account's own numbers.
export function Customer({ game, c, workloadId, openPma }: { game: GameState; c: Cluster; workloadId: string; openPma?: () => void }) {
  const [page, setPage] = useState<Page | null>(null);
  const w = game.workloads.find((x) => x.id === workloadId), v = game.services.find((x) => x.id === w?.serviceId), ws = webspaceOf(game, workloadId);
  if (!ws) return null;
  // The company's own accounts have no service and no package, so only their disk use shows.
  const u = w && accountUse(game, w), domain = ws.domain, app = v?.spec.app, offline = game.security.offline.includes(c.id);
  const body = () => {
    if (offline) return <p className="cx-empty">{t("readouts.cp.offline")}</p>;
    if (page) return <WebTool game={game} c={c} workloadId={workloadId} page={page} />;
    return (
      <div className="cp-icons">
        {[...ICONS, ...domainTiles(yearOf(game.hour)), ...mailFtpIcons(yearOf(game.hour))].map(([id, key, Icon]) => <button key={id} className="cx-tile" onClick={() => (id === "pma" ? openPma?.() : setPage(id))}><Icon size={28} aria-hidden /><span>{t(key)}</span></button>)}
      </div>
    );
  };
  return (
    <div className="cp-customer">
      <aside className="cp-stats">
        <h2>{t("readouts.cp.stats")}</h2>
        <div><span>{t("readouts.cp.disk")}</span>{Number.isFinite(ws.usage.quotaMb) ? <Bar use={[ws.usage.diskMb / 1024, ws.usage.quotaMb / 1024]} /> : <b className="num">{disk(+(ws.usage.diskMb / 1024).toFixed(3))}</b>}</div>
        {u && u.traffic[1] > 0 && <div><span>{t("readouts.cp.bandwidth")}</span><Bar use={u.traffic} /></div>}
        <div><span>{t("readouts.cp.mail")}</span><b className="num">{u?.mailboxes ?? ws.usage.mailboxes}</b></div>
        <div><span>{v ? APP_NAME[app ?? "static"] : t("pkg.domain")}</span><b>{domain}</b></div>
      </aside>
      <section className="cp-cust-main">
        {page && !offline && <button className="cx-btn" onClick={() => setPage(null)}>{t("readouts.cp.back")}</button>}
        {body()}
      </section>
    </div>
  );
}
