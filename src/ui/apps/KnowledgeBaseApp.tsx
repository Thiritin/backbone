import { HOW_TO } from "../../sim/40-support/tickets";
import { t } from "../../i18n/en";
import { useStore } from "../store";

export function KnowledgeBaseApp() {
  const reads = useStore((s) => s.game.kbReads);
  const articles = Object.keys(HOW_TO).filter((topic) => HOW_TO[topic].basic);
  return (
    <div style={{ padding: 16, overflow: "auto" }}>
      <table className="table">
        <thead><tr><th>Article</th><th className="r">Reads</th></tr></thead>
        <tbody>
          {articles.map((topic) => (
            <tr key={topic}><td>{t(`ticket.howTo.${topic}.subject`, {})}</td><td className="r num">{reads[topic] ?? 0}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
