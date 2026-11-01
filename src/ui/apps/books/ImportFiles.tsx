import { FileText } from "lucide-react";
import { t } from "../../../i18n/en";
import type { Doc, GameState } from "../../../sim/50-state";
import { importFile } from "../../../sim/90-actions/dataflow";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";

// The desktop files Books takes in: shop exports and bank statements.
export const importable = (s: GameState): Doc[] => s.docs.filter((d) => d.file && (d.file.kind === "shop" || d.file.kind === "statement"));
export const unimported = (s: GameState): number => importable(s).filter((d) => !d.file!.imported.includes(s.books.vendor ?? "")).length;

// Books' Import dialog: every file of a kind it reads, each imported once.
export function ImportFiles({ onClose }: { onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const files = importable(game);
  return (
    <div className="books-files" role="dialog" aria-label={t("dataFlow.import")}>
      {files.length ? (
        <table className="books-files-list">
          <thead><tr><th>{t("dataFlow.file")}</th><th>{t("dataFlow.created")}</th><th /></tr></thead>
          <tbody>
            {files.map((d) => (
              <tr key={d.id}>
                <td><FileText size={14} /> {d.title}</td>
                <td className="num">{formatDay(d.file!.at)}</td>
                <td>{d.file!.imported.includes(game.books.vendor ?? "")
                  ? <span className="books-imported">{t("dataFlow.imported")}</span>
                  : <button className="btn primary" onClick={() => act(importFile, d.id)}>{t("dataFlow.import")}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="books-files-none">{t("dataFlow.noFiles")}</p>}
      <button className="btn ghost" type="button" onClick={onClose}>{t("support.close")}</button>
    </div>
  );
}
