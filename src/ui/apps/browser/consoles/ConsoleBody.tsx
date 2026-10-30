import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import type { ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { mailImpaired, seatsFor } from "../../../../sim/80-business/mail";
import { Actions, Backups, Facts, RowsTable, useRows, useSoftware } from "./PanelBase";

export { Nodes, type Tab } from "./PanelBase";

export const objectsLabel = (f: ConsoleFeatures, c: Cluster): string =>
  c.kind === "dns" ? "DNS zones" : c.kind === "vpn" ? "VPN gateways" : c.kind === "storage" ? "Storage volumes" : f.look === "game" ? "Game servers" : f.look === "mail" ? "Mailboxes" : c.kind === "cloud" ? "Virtual machines" : "Web spaces";

interface Props { game: GameState; c: Cluster; f: ConsoleFeatures }

export function Objects({ game, c, f, node }: Props & { node: string | null }) {
  const rows = useRows(game, c, f, node);
  if (f.look === "mail") {
    const mine = game.company.mail.kind === "self" && game.company.mail.clusterId === c.id;
    return (
      <table className="cx-table">
        <tbody>
          <tr><th>Mailboxes</th><td className="num">{mine ? seatsFor(game) : 0}</td></tr>
          <tr><th>Delivery</th><td>{mine && mailImpaired(game) ? "Delayed" : "Normal"}</td></tr>
        </tbody>
      </table>
    );
  }
  const web = c.kind === "panel";
  return (
    <>
      <RowsTable rows={rows} name={web ? "Domain" : "Name"} node={!web} />
    </>
  );
}

export function Software({ game, c, f }: Props) {
  const sw = useSoftware(game, c, f);
  return (
    <>
      <Facts facts={sw.facts} />
      <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
      {sw.panel}
      {f.backups && <Backups game={game} c={c} />}
    </>
  );
}
