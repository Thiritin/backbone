import { useState } from "react";
import { FileText, KeyRound, Paperclip, Receipt } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import type { Attachment } from "../../../sim/42-mail/types";
import { view } from "../../../sim/42-mail/model";
import type { Row } from "../../../sim/43-pear-mail/view";
import type { GameState } from "../../../sim/50-state";
import { saveAttachment } from "../../../sim/90-actions/mailmsg";
import { markPearJunk } from "../../../sim/90-actions/pear-junk";
import { shownJunk } from "../../../sim/43-pear-mail/junk";
import { useStore } from "../../store";
import { TicketSlot } from "../mail-kit/TicketSlot";
import { mailDate } from "./List";
import { LOGIN_MAILS } from "../browser/sites/desk/headless/useTicketPane";
import { isLicence } from "../../../sim/80-business/licences";

function Att({ game, row, att, i }: { game: GameState; row: Row; att: Attachment; i: number }) {
  const act = useStore((s) => s.act);
  const openDoc = useStore((s) => s.openDoc), openApp = useStore((s) => s.openApp);
  const local = row.c.protocol === "pop";
  if (att.k === "key") {
    const keys = game.licenses.filter((k) => k.orderId === att.order);
    return (
      <li className="pm-att">
        <KeyRound /><span className="pm-att-name">{t("pearMail.att.keys")}</span>
        {keys.map((k) => <span key={k.id} className="pm-key"><code>{k.key}</code><button className="btn sm" onClick={() => navigator.clipboard?.writeText(k.key)}>{t("pearMail.att.copy")}</button></span>)}
      </li>
    );
  }
  if (att.k === "invoice") return <li className="pm-att"><Receipt /><span className="pm-att-name">{t(`purchase.doc.${game.payables.find((x) => x.id === att.id)?.doc ?? "invoice"}`)}</span><button className="btn sm" onClick={() => openApp("Preview", { kind: "payable", id: att.id })}>{t("pearMail.att.open")}</button></li>;
  const doc = att.k === "doc" ? game.docs.find((d) => d.id === att.id) : undefined;
  return (
    <li className="pm-att">
      {att.k === "doc" ? <FileText /> : <Paperclip />}
      <span className="pm-att-name">{att.k === "doc" ? doc?.title ?? "" : att.name}</span>
      {att.k === "file" && <span className="pm-att-size">{t("pearMail.att.size", { size: att.kb.toLocaleString(LOCALE) })}</span>}
      {doc && <button className="btn sm" onClick={() => openDoc(doc.id)}>{t("pearMail.att.open")}</button>}
      {!local && (doc || att.k === "file") && <button className="btn sm" onClick={() => act(saveAttachment, row.c.accountId, row.m.id, i)}>{t("pearMail.att.save")}</button>}
    </li>
  );
}

function Transfer({ locked, onAnswer }: { locked: boolean; onAnswer: (code: string | null) => void }) {
  const [code, setCode] = useState("");
  return (
    <form className="pm-replies" onSubmit={(e) => { e.preventDefault(); onAnswer(code); }}>
      <input className="field" aria-label={t("registrarForm.authCode")} placeholder={t("registrarForm.authCode")} spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
      <button className="btn primary" disabled={locked || !code.trim()}>{t("support.sendCode")}</button>
      <button type="button" className="btn" disabled={locked} onClick={() => onAnswer(null)}>{t("support.refuseTransfer")}</button>
    </form>
  );
}

export function Preview({ game, row }: { game: GameState; row: Row | null }) {
  const openApp = useStore((s) => s.openApp), act = useStore((s) => s.act);
  if (!row) return <div className="pm-preview empty">{t("pearMail.noMessage")}</div>;
  const v = view(game, row.m);
  return (
    <article className="pm-preview">
      {shownJunk(game, row.m) && (
        <div className="pm-banner pm-junk-banner">
          <span>{t("pearMail.junkBanner")}</span>
          <button className="btn sm" onClick={() => act(markPearJunk, row.c.id, [row.m.id], false)}>{t("pearMail.notJunk")}</button>
        </div>
      )}
      <header className="pm-head">
        <dl>
          <dt>{t("pearMail.field.from")}</dt><dd><strong>{v.fromName}</strong>{v.fromAddress && v.fromAddress !== v.fromName && <span className="pm-addr"> &lt;{v.fromAddress}&gt;</span>}</dd>
          <dt>{t("pearMail.field.subject")}</dt><dd><strong>{v.subject}</strong></dd>
          <dt>{t("pearMail.field.date")}</dt><dd>{mailDate(row.m.at)}</dd>
          <dt>{t("pearMail.field.to")}</dt><dd>{v.to}</dd>
          {v.cc.length > 0 && <><dt>{t("pearMail.field.cc")}</dt><dd>{v.cc.join(", ")}</dd></>}
        </dl>
      </header>
      <div className="pm-body">{game.pearMail.prefs.quoteColor ? v.text.split("\n").map((l, i) => <span key={i} className={l.startsWith(">") ? "pm-quoted" : undefined}>{l}{"\n"}</span>) : v.text}</div>
      {LOGIN_MAILS.includes(row.m.topic) && row.m.p?.url && <p><button className="btn primary" onClick={() => openApp("Browser", { kind: "url", id: String(row.m.p!.url) })}>{t("apps.open")}</button></p>}
      {isLicence(row.m.topic) && <p><button className="btn primary" onClick={() => openApp("Books", { kind: "register", id: "" })}>{t("vendor-sites.register")}</button></p>}
      {v.att.length > 0 && <ul className="pm-atts">{v.att.map((a, i) => <Att key={i} game={game} row={row} att={a} i={i} />)}</ul>}
      <TicketSlot
        game={game}
        message={row.m}
        previews={false}
        desk={(url) => (
          <div className="pm-banner">
            <span>{t("pearMail.desk")}</span>
            <button className="btn sm" onClick={() => openApp("Browser", { kind: "url", id: url })}>{t("pearMail.att.open")}</button>
          </div>
        )}
        frame={(b) => <div className="pm-ticket">{b}</div>}
        templates={(m, h) => (
          <div className="pm-replies">
            {m.templates!.map((x) => <button key={x.id} className="btn" disabled={m.locked} onClick={() => h.reply(x.id)}>{x.title}</button>)}
          </div>
        )}
        offers={(m, h) => (
          <div className="pm-replies">
            {m.offers!.map((o) => <button key={o.id} className="btn" disabled={m.locked} onClick={() => h.retain(o.id)}>{o.title} <span className="num">{o.value}</span> <span className={`odds ${o.odds}`}>{o.oddsLabel}</span></button>)}
          </div>
        )}
        transfer={(m, h) => <Transfer locked={m.locked} onAnswer={h.transfer} />}
        buttons={(m, h) => (
          <div className="pm-replies">
            {m.actions.map((a) => <button key={a.id} className="btn" disabled={a.disabled} onClick={() => h.action(a.id)}>{a.label}{a.amount !== null && ` (${a.amount})`}</button>)}
            {m.answers.map((a) => <button key={a.id} className={a.primary ? "btn primary" : "btn"} disabled={a.disabled} onClick={() => h.answer(a.id)}>{a.label}</button>)}
            {m.close !== null && <button className="btn" disabled={m.locked} onClick={h.close}>{m.close}</button>}
            {m.resolve && <button className="btn primary" disabled={m.locked} onClick={h.resolve}>{t("support.resolve")}</button>}
          </div>
        )}
      />
    </article>
  );
}
