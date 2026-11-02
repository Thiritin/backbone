import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import type { DeskAi } from "../../../../../../sim/10-catalog/desks";
import { aiOffered, aiOn, ANSWER_BOT_FEE, DESK_AI_FEE, draftOf, GENERATIVE } from "../../../../../../sim/40-support/desk-ai";
import { outgoing } from "../../../../../../sim/40-support/replies";
import { HOW_TO, type Ticket } from "../../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../../sim/50-state";
import { kbArticles } from "../../../../../../sim/80-business/website";
import { setDeskAi } from "../../../../../../sim/90-actions/desk";
import { replyTicket } from "../../../../../../sim/90-actions/support";
import { useStore } from "../../../../../store";

type Brand = "zd" | "fd";
const FEATURES: DeskAi[] = ["suggestedArticles", "answerBot", "autoAnswer", "drafting"];
export const aiFeatures = (game: GameState): DeskAi[] => FEATURES.filter((a) => aiOffered(game, a));
const title = (topic: string) => t(`ticket.howTo.${topic}.subject`, {});

// The switches of the AI page and the month's answer bot results, in the table style of the desk.
export function AiSwitches({ game, brand }: { game: GameState; brand: Brand }) {
  const act = useStore((s) => s.act), on = game.desk?.ai.on ?? {}, ai = game.desk?.ai;
  return (
    <>
      <table className={`${brand}-table`}>
        <thead><tr><th>{t("ai.feature")}</th><th>{t("ai.status")}</th></tr></thead>
        <tbody>{aiFeatures(game).map((a) => (
          <tr key={a}>
            <td>{t(`ai.${brand}.${a}`)}</td>
            <td><label><input type="checkbox" checked={!!on[a]} onChange={(e) => act(setDeskAi, a, e.target.checked)} /> {t(on[a] ? "ai.on" : "ai.off")}</label></td>
          </tr>
        ))}</tbody>
      </table>
      {aiOffered(game, "answerBot") && ai && (
        <table className={`${brand}-info`}><tbody>
          <tr><th>{t("ai.solved")}</th><td>{ai.solved}</td></tr>
          <tr><th>{t("ai.tried")}</th><td>{ai.tried}</td></tr>
          <tr><th>{t("ai.fee")}</th><td>{euroCents(ANSWER_BOT_FEE)}</td></tr>
        </tbody></table>
      )}
      {GENERATIVE.some((a) => aiOffered(game, a)) && ai && (
        <table className={`${brand}-info`}><tbody>
          <tr><th>{t("ai.agentReplies")}</th><td>{ai.usage.attempts}</td></tr>
          <tr><th>{t("ai.drafts")}</th><td>{ai.usage.drafts}</td></tr>
          <tr><th>{t("ai.tokenCost")}</th><td>{euroCents(ai.usage.cost)}</td></tr>
          <tr><th>{t("ai.addonFee")}</th><td>{euroCents(DESK_AI_FEE)}</td></tr>
        </tbody></table>
      )}
    </>
  );
}

// Articles whose title shares a word with what the customer typed, while suggestions are on.
export function suggested(game: GameState, text: string): string[] {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (!words.length || !aiOn(game, "suggestedArticles")) return [];
  return kbArticles(game).map((a) => a.topic).filter((topic) => words.some((w) => title(topic).toLowerCase().includes(w))).slice(0, 3);
}

// The article behind a basic how-to ticket, for the agent sidebar.
export const ticketArticle = (game: GameState, tk: Ticket): string | null =>
  tk.kind === "howTo" && tk.topic && HOW_TO[tk.topic]?.basic && aiOn(game, "suggestedArticles") ? tk.topic : null;

export function Suggested({ topics, brand, open }: { topics: string[]; brand: Brand; open: (topic: string) => void }) {
  if (!topics.length) return null;
  return (
    <section className={`${brand}-suggested`}>
      <h4>{t(`ai.${brand}.suggested`)}</h4>
      <ul>{topics.map((x) => <li key={x}><a onClick={() => open(x)}>{title(x)}</a></li>)}</ul>
    </section>
  );
}

// The drafted reply above the composer: its text and one click to send it.
export function DraftBox({ game, tk, brand }: { game: GameState; tk: Ticket; brand: Brand }) {
  const act = useStore((s) => s.act), draft = draftOf(tk);
  if (!draft || !aiOn(game, "drafting")) return null;
  const o = outgoing(game, tk, game.customers.find((c) => c.id === tk.customerId), `tpl.${draft}`);
  return (
    <section className={`${brand}-draft`}>
      <h4>{t("ai.draft")}</h4>
      <p>{t(o.key ?? "", o.params)}</p>
      <button type="button" className={`${brand}-btn primary`} onClick={() => act(replyTicket, tk.id, draft)}>{t("ai.sendDraft")}</button>
    </section>
  );
}
