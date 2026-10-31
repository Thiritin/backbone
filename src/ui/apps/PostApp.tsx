import { useSessionState } from "../session";
import { t } from "../../i18n/en";
import { inbox } from "../../sim/40-support/letters";
import { readLetter } from "../../sim/90-actions/paperwork";
import { useStore } from "../store";
import { paperDay } from "./FormDoc";
import { payUrl } from "./books/PayablesTab";
import "./paper.css";

// Letters from the post, newest first; a bill carries a Pay button like the Books payables.
export function PostApp() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const [sel, setSel] = useSessionState<string | null>("post.sel", null);
  const letters = [...inbox(game)].reverse(), l = letters.find((x) => x.id === sel);
  const bill = l?.payable ? game.payables.find((p) => p.id === l.payable) : undefined;
  const open = (id: string, read: boolean) => { setSel(id); if (!read) act(readLetter, id); };
  return (
    <div className="post">
      <div className="post-list" role="list">
        {letters.map((x) => (
          <button key={x.id} role="listitem" className={`post-row${x.id === sel ? " active" : ""}${x.read ? "" : " unread"}`} onClick={() => open(x.id, x.read)}>
            <strong>{x.from}</strong>
            <span>{t(`letter.${x.topic}.subject`, x.params)}</span>
            <small className="num">{paperDay(x.at)}</small>
          </button>
        ))}
        {!letters.length && <div className="post-none">{t("paperwork.post.empty")}</div>}
      </div>
      {l && (
        <div className="paper-scroll">
          <article className="paper">
            <div className="paper-head"><strong>{l.from}</strong><span className="num">{paperDay(l.at)}</span></div>
            <h1>{t(`letter.${l.topic}.subject`, l.params)}</h1>
            <p>{t(`letter.${l.topic}.body`, l.params)}</p>
            {bill && (
              <div className="paper-bill">
                {bill.paidAt !== null ? <span>{t("bank.pay.paid")}</span>
                  : game.bank && <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: payUrl(game, bill) })}>{t("bank.pay.pay")}</button>}
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
