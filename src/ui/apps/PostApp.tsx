import { useSessionState } from "../session";
import { t } from "../../i18n/en";
import { inbox, type Letter as Post } from "../../sim/40-support/letters";
import { readLetter } from "../../sim/90-actions/paperwork";
import { useStore } from "../store";
import { paperDay } from "./FormDoc";
import { payUrl } from "./books/PayablesTab";
import { LETTERHEADS } from "../art/letterheads";
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
          <div className="letter-fit">
            <Letter letter={l} company={game.company.name} owner={game.registration?.owner} />
          </div>
          {bill && (
            <div className="letter-actions">
              {bill.paidAt !== null ? <span>{t("bank.pay.paid")}</span>
                : game.bank && <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: payUrl(game, bill) })}>{t("bank.pay.pay")}</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The player's basement office, where the post arrives.
const HOME = ["Kellerweg 3", "60311 Frankfurt am Main"];

// One A4 page laid out after DIN 5008 form B: letterhead, window address, reference block, fold and punch marks, footer.
function Letter({ letter: l, company, owner }: { letter: Post; company: string; owner?: string }) {
  const h = LETTERHEADS[l.from], p = l.params;
  const ref = p.number ?? (p.reg ? `GA ${p.reg}` : null);
  const bank = p.iban ? `IBAN ${p.iban}` : p.account ? `${t("paperwork.letter.account")} ${p.account} · ${t("paperwork.letter.code")} ${p.code}` : null;
  return (
    <article className={`letter${h?.serif ? " serif" : ""}`}>
      <i className="letter-mark fold1" /><i className="letter-mark punch" /><i className="letter-mark fold2" />
      <header className="letter-head">
        {h && <span className="letter-logo">{h.mark}</span>}
        <div><strong>{h?.org ?? l.from}</strong>{h && <span>{t(h.dept)}</span>}</div>
      </header>
      <div className="letter-window">
        {h && <small>{[h.org, h.street, h.city].join(" · ")}</small>}
        <address>{[company, owner, ...HOME].filter(Boolean).map((x) => <span key={x}>{x}</span>)}</address>
      </div>
      <dl className="letter-info">
        {ref && <><dt>{t("paperwork.letter.ourRef")}</dt><dd>{ref}</dd></>}
        {h && <><dt>{t("paperwork.letter.phone")}</dt><dd>{h.phone}</dd></>}
        <dt>{t("paperwork.letter.date")}</dt><dd>{paperDay(l.at)}</dd>
      </dl>
      <div className="letter-body">
        <h1>{t(`letter.${l.topic}.subject`, p)}</h1>
        <p>{t("paperwork.letter.greeting")}</p>
        <p>{t(`letter.${l.topic}.body`, p)}</p>
        <p>{t("paperwork.letter.closing")}</p>
        {h?.signer ? <p className="letter-sign"><span className="paper-ink">{h.signer}</span>{h.signer}</p> : <p className="letter-machine">{t("paperwork.letter.machine")}</p>}
      </div>
      {h && (
        <footer className="letter-foot">
          <div><span>{h.org}</span><span>{h.street}</span><span>{h.city}</span></div>
          <div><span>{t("paperwork.letter.phone")} {h.phone}</span><span>{h.web}</span></div>
          {bank && <div><span>{t("paperwork.letter.bank")}</span><span>{bank}</span></div>}
        </footer>
      )}
    </article>
  );
}
