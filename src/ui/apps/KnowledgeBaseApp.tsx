import { kbArticles } from "../../sim/80-business/website";
import { t } from "../../i18n/en";
import { useStore } from "../store";

export function KnowledgeBaseApp() {
  const game = useStore((s) => s.game);
  return (
    <div style={{ padding: 16, overflow: "auto" }}>
      <table className="table">
        <thead><tr><th>{t("apps.kb.article")}</th><th className="r">{t("apps.kb.reads")}</th></tr></thead>
        <tbody>
          {kbArticles(game).map(({ topic, reads }) => (
            <tr key={topic}><td>{t(`ticket.howTo.${topic}.subject`, {})}</td><td className="r num">{reads}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
