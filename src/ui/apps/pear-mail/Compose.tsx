import { useState } from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { t } from "../../../i18n/en";
import { addressesOf, view } from "../../../sim/42-mail/model";
import type { Message } from "../../../sim/42-mail/types";
import type { ClientAccount } from "../../../sim/43-pear-mail/state";
import type { GameState } from "../../../sim/50-state";
import { discardPearDraft, savePearDraft, sendPearMessage } from "../../../sim/90-actions/pear-mail";
import { useStore, useWin } from "../../store";
import { useDraft, type DraftFields } from "../mail-kit/mail-kit";
import "./pear-mail.css";

// The client account that holds a draft: its local copy for POP, the server's Drafts for IMAP.
export function findDraft(s: GameState, id: string): { c: ClientAccount; m: Message } | null {
  const local = s.pearMail.local.messages.find((m) => m.id === id && m.draft);
  if (local) { const c = s.pearMail.accounts.find((x) => x.id === local.origin); return c ? { c, m: local } : null; }
  for (const c of s.pearMail.accounts) {
    const m = (s.mail.msgs[c.accountId] ?? []).find((x) => x.id === id && x.draft);
    if (m) return { c, m };
  }
  return null;
}

export const composeTitle = (s: GameState, id: string): string => {
  const d = findDraft(s, id);
  return (d && view(s, d.m).subject) || t("pearMail.newMessage");
};

const fields = (d: DraftFields) => ({ to: [d.to], cc: [d.cc], bcc: [d.bcc], subject: d.subject, text: d.text, att: d.att, re: d.re });

export function Compose({ id }: { id: string }) {
  const game = useStore((s) => s.game);
  const found = findDraft(game, id);
  return found ? <ComposeForm key={id} game={game} c={found.c} m={found.m} /> : <div className="pm-compose" />;
}

function ComposeForm({ game, c, m }: { game: GameState; c: ClientAccount; m: Message }) {
  const act = useStore((s) => s.act);
  const { close } = useWin();
  const v = view(game, m);
  const [from, setFrom] = useState(`${c.id}|${c.address}`);
  const [attach, setAttach] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState(!!(m.cc?.length || m.bcc?.length));
  const { draft, set, send } = useDraft({ to: v.to, cc: v.cc.join(", "), bcc: (m.bcc ?? []).join(", "), subject: v.subject, text: v.text, att: m.att ?? [], re: m.re }, {
    save: (d) => act(savePearDraft, c.id, { ...fields(d), id: m.id }),
    discard: () => act(discardPearDraft, c.id, m.id),
    send: (d) => {
      const [clientId, address] = from.split("|");
      const r = act(sendPearMessage, clientId, { ...fields(d), from: address, draftId: m.id, draftOf: c.id });
      return r.ok ? null : r.error;
    },
  });
  const senders = game.pearMail.accounts.filter((x) => x.enabled).flatMap((x) => {
    const box = game.mail.accounts.find((a) => a.id === x.accountId);
    return (box ? addressesOf(box) : [x.address]).map((address) => ({ value: `${x.id}|${address}`, label: `${x.description} <${address}>` }));
  });
  const forms = game.docs.filter((d) => d.kind === "form" && !draft.att.some((a) => a.k === "doc" && a.id === d.id));
  const row = (label: string, key: "to" | "cc" | "bcc" | "subject") => (
    <label className="pm-field">
      <span>{t(label)}</span>
      <input value={draft[key]} spellCheck={key === "subject"} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );
  return (
    <form className="pm pm-compose" onSubmit={(e) => { e.preventDefault(); const err = send(); if (err) setError(err); else close(); }}>
      <div className="pm-toolbar">
        <button className="pm-tool" type="submit"><span className="pm-tool-face"><Send /></span>{t("pearMail.send")}</button>
        <button className="pm-tool" type="button" onClick={() => setAttach(true)}><span className="pm-tool-face"><Paperclip /></span>{t("pearMail.attach")}</button>
        <span className="pm-grow" />
        <button className="btn sm" type="button" aria-pressed={extra} onClick={() => setExtra(!extra)}>{t("pearMail.ccHeader")}</button>
      </div>
      <div className="pm-fields">
        {row("pearMail.field.to", "to")}
        {extra && row("pearMail.field.cc", "cc")}
        {extra && row("pearMail.field.bcc", "bcc")}
        {row("pearMail.field.subject", "subject")}
        <label className="pm-field">
          <span>{t("pearMail.field.from")}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>{senders.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
        </label>
      </div>
      <textarea className="pm-text" aria-label={t("pearMail.message")} value={draft.text} onChange={(e) => set({ text: e.target.value })} />
      {draft.att.length > 0 && (
        <ul className="pm-atts">
          {draft.att.map((a, i) => (
            <li key={i} className="pm-att">
              <FileText /><span className="pm-att-name">{a.k === "doc" ? game.docs.find((d) => d.id === a.id)?.title : a.k === "file" ? a.name : t(a.k === "key" ? "pearMail.att.keys" : "pearMail.att.invoice")}</span>
              <button type="button" className="btn sm" aria-label={t("pearMail.remove")} onClick={() => set({ att: draft.att.filter((_, j) => j !== i) })}><X /></button>
            </li>
          ))}
        </ul>
      )}
      {attach && (
        <div className="pm-sheet" role="dialog" aria-labelledby="pm-attach">
          <h2 id="pm-attach">{t("pearMail.attachTitle")}</h2>
          <div className="pm-replies">
            {forms.map((d) => <button key={d.id} type="button" className="btn" onClick={() => { set({ att: [...draft.att, { k: "doc", id: d.id }] }); setAttach(false); }}><FileText />{d.title}</button>)}
          </div>
          <button type="button" className="btn" onClick={() => setAttach(false)}>{t("desktop.cancel")}</button>
        </div>
      )}
      {error && (
        <div className="pm-sheet" role="alertdialog" aria-labelledby="pm-error">
          <h2 id="pm-error">{t(error)}</h2>
          <button type="button" className="btn primary" onClick={() => setError(null)}>{t("pearMail.ok")}</button>
        </div>
      )}
    </form>
  );
}
