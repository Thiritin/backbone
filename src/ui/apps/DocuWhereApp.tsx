import { Archive, FileText, Inbox, Search } from "lucide-react";
import { useSessionState } from "../session";
import { t } from "../../i18n/en";
import { archive, docType, DOC_TYPES, inbox, type DocType } from "../../sim/40-support/letters";
import { readLetter, retypeLetter } from "../../sim/90-actions/paperwork";
import { useStore } from "../store";
import { paperDay } from "./FormDoc";
import { Letter } from "./PostApp";
import "./paper.css";
import "./dms.css";

type Box = "all" | "inbox" | DocType;

// The paper post as a filed archive: a type facet on the side, the hit list with a search field on top, the letter as preview.
export function DocuWhereApp() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [box, setBox] = useSessionState<Box>("dms.box", "all");
  const [query, setQuery] = useSessionState("dms.query", "");
  const [sel, setSel] = useSessionState<string | null>("dms.sel", null);
  const found = archive(game, query);
  const list = found.filter((l) => box === "all" || (box === "inbox" ? !l.read : docType(l) === box)).reverse();
  const l = inbox(game).find((x) => x.id === sel);
  const open = (id: string, read: boolean) => { setSel(id); if (!read) act(readLetter, id); };
  const item = (id: Box, label: string, Icon: typeof Inbox, count: number) => (
    <button key={id} className={`side-item${box === id ? " active" : ""}`} aria-pressed={box === id} onClick={() => setBox(id)}>
      <Icon />{label}<span className="side-count">{count}</span>
    </button>
  );
  return (
    <div className="dms">
      <aside className="sidebar dms-side">
        <div className="side-h">{t("dms.archive")}</div>
        {item("all", t("dms.all"), Archive, found.length)}
        {item("inbox", t("dms.inbox"), Inbox, found.filter((x) => !x.read).length)}
        <div className="side-h">{t("dms.docType")}</div>
        {DOC_TYPES.map((k) => item(k, t(`dms.type.${k}`), FileText, found.filter((x) => docType(x) === k).length))}
      </aside>
      <div className="dms-main">
        <label className="dms-search"><Search aria-hidden /><input type="search" aria-label={t("dms.search")} placeholder={t("dms.search")} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <div className="dms-list">
          <table>
            <thead><tr><th>{t("dms.date")}</th><th>{t("dms.sender")}</th><th>{t("dms.subject")}</th><th>{t("dms.docType")}</th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className={`${x.id === sel ? "active" : ""}${x.read ? "" : " unread"}`} onClick={() => open(x.id, x.read)}>
                  <td className="num">{paperDay(x.at)}</td><td>{x.from}</td><td>{t(`letter.${x.topic}.subject`, x.params)}</td><td>{t(`dms.type.${docType(x)}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="post-none">{t("dms.none")}</div>}
        </div>
      </div>
      {l && (
        <div className="dms-preview">
          <label className="dms-type">{t("dms.docType")}
            <select value={docType(l)} onChange={(e) => act(retypeLetter, l.id, e.target.value as DocType)}>
              {DOC_TYPES.map((k) => <option key={k} value={k}>{t(`dms.type.${k}`)}</option>)}
            </select>
          </label>
          <div className="paper-scroll">
            <div className="letter-fit"><Letter letter={l} company={game.company.name} owner={game.registration?.owner} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
