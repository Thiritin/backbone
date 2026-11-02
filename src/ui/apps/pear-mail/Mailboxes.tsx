// The mailbox sheets: New Mailbox, Rename, Delete, Erase and Get Account Info.
import { useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { capsOf } from "../../../sim/42-mail/caps";
import type { Folder } from "../../../sim/42-mail/types";
import { MY_PEAR } from "../../../sim/43-pear-mail/state";
import { clientFolder, clientFolders, myFolders } from "../../../sim/43-pear-mail/view";
import { erasePearMailbox } from "../../../sim/90-actions/pear-mail";
import { Confirm } from "../../desktop/Confirm";
import { useStore } from "../../store";
import { customBox, mailboxOps, type Box } from "./commands";
import type { Sheet } from "./menus";

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="pm-row"><span>{label}</span>{children}</label>;
const depth = (f: Folder, all: Folder[]): number => (f.parent ? 1 + depth(all.find((x) => x.id === f.parent) ?? { ...f, parent: null }, all) : 0);

function Frame({ title, error, onClose, onSubmit, children }: { title: string; error: string | null; onClose: () => void; onSubmit?: () => void; children: ReactNode }) {
  return (
    <form className="pm-sheet" role="dialog" aria-labelledby="pm-box-title" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
      <h2 id="pm-box-title">{title}</h2>
      <div className="pm-form">{children}</div>
      {error && <p className="pm-error" role="alert">{t(error)}</p>}
      <div className="pm-sheet-buttons">
        <span className="pm-grow" />
        {onSubmit && <button type="button" className="btn" onClick={onClose}>{t("pearMail.cancel")}</button>}
        <button type={onSubmit ? "submit" : "button"} className="btn primary" onClick={onSubmit ? undefined : onClose}>{t("pearMail.ok")}</button>
      </div>
    </form>
  );
}

// Location lists every IMAP account and On My Pear with the mailboxes inside them, so it also picks the parent.
function NewMailbox({ box, onClose }: { box: Box; onClose: () => void }) {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt);
  const places = [
    ...game.pearMail.accounts.filter((c) => c.protocol === "imap" && c.enabled).map((c) => ({ c: c.id, label: c.description, folders: clientFolders(game, c).filter((f) => !!customBox(game, { c: c.id, f: f.id })) })),
    { c: MY_PEAR, label: t("pearMail.onMyPear"), folders: myFolders(game) },
  ];
  const start = box.c && places.some((p) => p.c === box.c) ? `${box.c}:${customBox(game, box) ? box.f : ""}` : `${MY_PEAR}:`;
  const [at, setAt] = useState(start);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const [c, f] = at.split(":");
    const r = mailboxOps(game, attempt, c).create(name, f || null);
    if (r.ok) onClose(); else setError(r.error ?? null);
  };
  return (
    <Frame title={t("pearMail.box.newTitle")} error={error} onClose={onClose} onSubmit={submit}>
      <Field label={t("pearMail.box.location")}>
        <select className="field" value={at} onChange={(e) => { setAt(e.target.value); setError(null); }}>
          {places.flatMap((p) => [
            <option key={p.c} value={`${p.c}:`}>{p.label}</option>,
            ...p.folders.map((f) => <option key={`${p.c}:${f.id}`} value={`${p.c}:${f.id}`}>{`${" ".repeat(depth(f, p.folders) + 1)}${f.name}`}</option>),
          ])}
        </select>
      </Field>
      <Field label={t("pearMail.box.name")}><input className="field" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus /></Field>
    </Frame>
  );
}

function Rename({ b, onClose }: { b: Box; onClose: () => void }) {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt);
  const f = customBox(game, b);
  const [name, setName] = useState(f?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const r = mailboxOps(game, attempt, b.c!).rename(b.f, name);
    if (r.ok) onClose(); else setError(r.error ?? null);
  };
  return (
    <Frame title={t("pearMail.box.renameTitle")} error={error} onClose={onClose} onSubmit={submit}>
      <Field label={t("pearMail.box.name")}><input className="field" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus /></Field>
    </Frame>
  );
}

// Get Account Info: the messages and size of each mailbox and the quota of the server mailbox.
function AccountInfo({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const game = useStore((s) => s.game);
  const imap = game.pearMail.accounts.filter((c) => c.protocol === "imap");
  const [id, setId] = useState(clientId);
  const c = imap.find((x) => x.id === id) ?? imap[0];
  const box = c && game.mail.accounts.find((a) => a.id === c.accountId);
  const n = (v: number) => v.toLocaleString(LOCALE);
  return (
    <Frame title={t("pearMail.info")} error={null} onClose={onClose}>
      <Field label={t("pearMail.info.account")}>
        <select className="field" value={c?.id ?? ""} onChange={(e) => setId(e.target.value)}>
          {imap.map((x) => <option key={x.id} value={x.id}>{x.description}</option>)}
        </select>
      </Field>
      {c && box && (
        <>
          <Field label={t("pearMail.info.quota")}><span>{t("pearMail.info.used", { used: n(Math.round(box.usedKb / 1024)), total: n(capsOf(game, box).quotaMb) })}</span></Field>
          <table className="table pm-info">
            <thead><tr><th>{t("pearMail.info.mailbox")}</th><th className="num">{t("pearMail.info.messages")}</th><th className="num">{t("pearMail.info.size")}</th></tr></thead>
            <tbody>
              {clientFolders(game, c).map((f) => {
                const ms = clientFolder(game, c, f.id);
                return <tr key={f.id}><td>{f.name}</td><td className="num">{n(ms.length)}</td><td className="num">{t("pearMail.att.size", { size: n(ms.reduce((k, m) => k + m.kb, 0)) })}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      )}
    </Frame>
  );
}

export type BoxSheet = Exclude<Sheet, { k: "rules" | "rule" | "smart" }>;
export function MailboxSheet({ sheet, box, onClose, onGone }: { sheet: BoxSheet; box: Box; onClose: () => void; onGone: (b: Box) => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  if (sheet.k === "new") return <NewMailbox box={box} onClose={onClose} />;
  if (sheet.k === "rename") return <Rename b={sheet.b} onClose={onClose} />;
  if (sheet.k === "info") return <AccountInfo clientId={sheet.c} onClose={onClose} />;
  if (sheet.k === "erase") {
    const trash = sheet.folder === "trash";
    return (
      <Confirm title={trash ? t("pearMail.erase.trashTitle") : t("pearMail.erase.junkTitle", { box: t("mail.folder.junk") })} text={t("pearMail.erase.text")} action={t("pearMail.erase.action")}
        onCancel={onClose} onConfirm={() => { act(erasePearMailbox, sheet.folder, sheet.c); onClose(); }} />
    );
  }
  const b = sheet.b, name = customBox(game, b)?.name ?? "";
  return (
    <Confirm title={t("pearMail.box.deleteTitle", { name })} text={t("pearMail.box.deleteText")} action={t("pearMail.delete")}
      onCancel={onClose} onConfirm={() => { if (mailboxOps(game, act, b.c!).remove(b.f).ok) onGone(b); onClose(); }} />
  );
}
