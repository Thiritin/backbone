import { useState } from "react";
import { squarecubeFeatures } from "../../../../../sim/10-catalog/squarecube";
import { foldersOf } from "../../../../../sim/42-mail/model";
import { selfHostCaps, webmailUser, type Contact, type Identity } from "../../../../../sim/80-business/webmail";
import { specialFolder, type SpecialFolder } from "../../../../../sim/80-business/webmail-view";
import { changePassword } from "../../../../../sim/90-actions/mailbox";
import { removeContact, removeIdentity, saveContact, saveIdentity, setWebmailPref } from "../../../../../sim/90-actions/webmail";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import { Folders } from "./Folders";
import { PAGE_SIZE, type Ctx, type Draft } from "./Mail";
import { Filters, Vacation } from "./Sieve";

const Field = ({ id, label, value, set, type = "text" }: { id: string; label: string; value: string; set: (v: string) => void; type?: string }) => (
  <tr><th><label htmlFor={id}>{label}</label></th><td><input id={id} type={type} value={value} onChange={(e) => set(e.target.value)} /></td></tr>
);

// The personal address book: the list with a search box on the left, the contact form on the right.
export function AddressBook({ ctx, compose }: { ctx: Ctx; compose: (d: Partial<Draft>) => void }) {
  const { game, c, account } = ctx, act = useStore((x) => x.attempt), contacts = webmailUser(game, c.id, account).contacts;
  const [q, setQ] = useState(""), [edit, setEdit] = useState<Contact | null>(null), [old, setOld] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);
  const rows = contacts.filter((x) => `${x.name} ${x.email}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  const save = () => {
    if (!edit) return;
    if (old && old !== edit.email.trim().toLowerCase()) act(removeContact, c.id, account, old);
    const r = act(saveContact, c.id, account, { ...edit, nick: edit.email.trim().toLowerCase() });
    setNote(t(r.ok ? "mailserver.sc.saved" : r.error ?? "error.mailAddress"));
    if (r.ok) setOld(edit.email.trim().toLowerCase());
  };
  return (
    <div className="scw-split">
      <aside>
        <div className="scw-toolbar">
          <button onClick={() => { setEdit({ nick: "", name: "", email: "", info: "" }); setOld(null); setNote(null); }}>{t("mailserver.sc.addContact")}</button>
          <button disabled={!old} onClick={() => { act(removeContact, c.id, account, old!); setEdit(null); setOld(null); }}>{t("mailserver.sc.delete")}</button>
          <button disabled={!old} onClick={() => compose({ to: old! })}>{t("mailserver.sc.compose")}</button>
        </div>
        <input type="search" aria-label={t("mailserver.sc.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <table className="scw-list"><tbody>
          {rows.map((x) => <tr key={x.nick} className={old === x.nick ? "on" : ""} onClick={() => { setEdit(x); setOld(x.nick); setNote(null); }}><td>{x.name || x.email}</td></tr>)}
        </tbody></table>
      </aside>
      {edit && (
        <form className="scw-pane" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <table className="scw-form"><tbody>
            <Field id="sca-name" label={t("mailserver.sc.displayName")} value={edit.name} set={(v) => setEdit({ ...edit, name: v })} />
            <Field id="sca-email" label={t("mailserver.sc.email")} value={edit.email} set={(v) => setEdit({ ...edit, email: v })} />
          </tbody></table>
          <p><button type="submit">{t("mailserver.sc.save")}</button> {note && <span className="scw-note" role="status">{note}</span>}</p>
        </form>
      )}
    </div>
  );
}

type Tab = "prefs" | "folders" | "identities" | "filters" | "vacation" | "password";

// Personal Settings: Preferences, Folders, Identities and the plugins of the version; managesieve needs Sieve on the server.
export function Settings({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<Tab>("prefs"), f = squarecubeFeatures(ctx.version), sieve = selfHostCaps(ctx.game).sieve;
  const tabs = (["prefs", "folders", "identities", ...(f.filters && sieve ? ["filters"] : []), ...(f.vacation && sieve ? ["vacation"] : []), ...(f.password ? ["password"] : [])]) as Tab[];
  return (
    <div className="scw-settings">
      <nav className="scw-tabs">{tabs.map((x) => <a key={x} href={`#${x}`} aria-current={x === tab ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab(x); }}>{t(`mailserver.sc.tab.${x}`)}</a>)}</nav>
      {tab === "prefs" && <Prefs ctx={ctx} />}
      {tab === "folders" && <Folders ctx={ctx} />}
      {tab === "identities" && <Identities ctx={ctx} />}
      {tab === "filters" && <Filters ctx={ctx} />}
      {tab === "vacation" && <Vacation ctx={ctx} />}
      {tab === "password" && <Password ctx={ctx} />}
    </div>
  );
}

function Prefs({ ctx }: { ctx: Ctx }) {
  const { game, c, account, version } = ctx, act = useStore((x) => x.attempt), u = webmailUser(game, c.id, account);
  const folders = foldersOf(game, account).filter((x) => !x.label && x.id !== "archive");
  const special = (k: SpecialFolder) => specialFolder(game, c.id, account, k);
  const [p, setP] = useState({ skin: String(u.prefs.skin ?? "classic"), pageSize: String(u.prefs.pageSize ?? PAGE_SIZE), htmlEditor: !!u.prefs.htmlEditor, drafts: special("drafts"), sent: special("sent"), trash: special("trash") });
  const [note, setNote] = useState<string | null>(null);
  const save = () => {
    const size = Math.min(200, Math.max(1, Math.round(Number(p.pageSize)) || PAGE_SIZE));
    const all: [string, string | number | boolean][] = [["skin", p.skin], ["pageSize", size], ["htmlEditor", p.htmlEditor], ["drafts", p.drafts], ["sent", p.sent], ["trash", p.trash]];
    setNote(t(all.every(([k, v]) => act(setWebmailPref, c.id, account, k, v).ok) ? "mailserver.sc.saved" : "mailserver.sc.sendFailed"));
  };
  const pick = (k: SpecialFolder) => (
    <tr key={k}><th><label htmlFor={`scp-${k}`}>{t(`mailserver.sc.special.${k}`)}</label></th><td>
      <select id={`scp-${k}`} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })}>
        {k === "trash" && <option value="">---</option>}
        {folders.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </td></tr>
  );
  return (
    <form className="scw-pane" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset><legend>{t("mailserver.sc.ui")}</legend><table className="scw-form"><tbody>
        <tr><th><label htmlFor="scp-skin">{t("mailserver.sc.skin")}</label></th><td>
          <select id="scp-skin" value={p.skin} onChange={(e) => setP({ ...p, skin: e.target.value })}>{squarecubeFeatures(version).skins.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
        </td></tr>
      </tbody></table></fieldset>
      <fieldset><legend>{t("mailserver.sc.mailboxView")}</legend><table className="scw-form"><tbody>
        <Field id="scp-size" label={t("mailserver.sc.pageSize")} value={p.pageSize} set={(v) => setP({ ...p, pageSize: v })} type="number" />
      </tbody></table></fieldset>
      <fieldset><legend>{t("mailserver.sc.composing")}</legend><table className="scw-form"><tbody>
        <tr><th><label htmlFor="scp-html">{t("mailserver.sc.htmlEditor")}</label></th><td><input id="scp-html" type="checkbox" checked={p.htmlEditor} onChange={(e) => setP({ ...p, htmlEditor: e.target.checked })} /></td></tr>
      </tbody></table></fieldset>
      <fieldset><legend>{t("mailserver.sc.specialFolders")}</legend><table className="scw-form"><tbody>{(["drafts", "sent", "trash"] as const).map(pick)}</tbody></table></fieldset>
      <p><button type="submit">{t("mailserver.sc.save")}</button> {note && <span className="scw-note" role="status">{note}</span>}</p>
    </form>
  );
}

function Identities({ ctx }: { ctx: Ctx }) {
  const { game, c, account } = ctx, act = useStore((x) => x.attempt), ids = webmailUser(game, c.id, account).identities;
  const [at, setAt] = useState<number | null>(0), [edit, setEdit] = useState<Identity>(ids[0]), [note, setNote] = useState<string | null>(null);
  const open = (i: number | null) => { setAt(i); setEdit(i === null ? { name: "", email: "", replyTo: "", signature: "" } : ids[i]); setNote(null); };
  const save = () => {
    const r = act(saveIdentity, c.id, account, at, edit);
    setNote(t(r.ok ? "mailserver.sc.saved" : r.error ?? "error.mailAddress"));
    if (r.ok && at === null) setAt(ids.length);
  };
  return (
    <div className="scw-split">
      <aside>
        <div className="scw-toolbar"><button onClick={() => open(null)}>{t("mailserver.sc.newIdentity")}</button></div>
        <table className="scw-list"><tbody>
          {ids.map((x, i) => <tr key={i} className={at === i ? "on" : ""} onClick={() => open(i)}><td>{x.name ? `${x.name} <${x.email}>` : x.email}</td></tr>)}
        </tbody></table>
      </aside>
      <form className="scw-pane" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <table className="scw-form"><tbody>
          <Field id="sci-name" label={t("mailserver.sc.displayName")} value={edit.name} set={(v) => setEdit({ ...edit, name: v })} />
          <Field id="sci-email" label={t("mailserver.sc.email")} value={edit.email} set={(v) => setEdit({ ...edit, email: v })} />
          <Field id="sci-reply" label={t("mailserver.sc.replyTo")} value={edit.replyTo} set={(v) => setEdit({ ...edit, replyTo: v })} />
          <tr><th><label htmlFor="sci-sig">{t("mailserver.sc.signature")}</label></th><td><textarea id="sci-sig" value={edit.signature} onChange={(e) => setEdit({ ...edit, signature: e.target.value })} /></td></tr>
        </tbody></table>
        <p>
          <button type="submit">{t("mailserver.sc.save")}</button>{" "}
          {at !== null && at > 0 && <button type="button" onClick={() => { act(removeIdentity, c.id, account, at); open(0); }}>{t("mailserver.sc.delete")}</button>}
          {note && <span className="scw-note" role="status">{note}</span>}
        </p>
      </form>
    </div>
  );
}

function Password({ ctx }: { ctx: Ctx }) {
  const act = useStore((x) => x.attempt), [p, setP] = useState({ cur: "", next: "", again: "" }), [note, setNote] = useState<string | null>(null);
  const save = () => {
    if (p.next !== p.again) return setNote(t("mailserver.sc.passMismatch"));
    const r = act(changePassword, ctx.account, p.cur, p.next);
    setNote(t(r.ok ? "mailserver.sc.saved" : r.error ?? "error.mailLogin"));
    if (r.ok) setP({ cur: "", next: "", again: "" });
  };
  return (
    <form className="scw-pane" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <table className="scw-form"><tbody>
        <Field id="scw-cur" label={t("mailserver.sc.curPass")} value={p.cur} set={(v) => setP({ ...p, cur: v })} type="password" />
        <Field id="scw-new" label={t("mailserver.sc.newPass")} value={p.next} set={(v) => setP({ ...p, next: v })} type="password" />
        <Field id="scw-again" label={t("mailserver.sc.confirmPass")} value={p.again} set={(v) => setP({ ...p, again: v })} type="password" />
      </tbody></table>
      <p><button type="submit">{t("mailserver.sc.save")}</button> {note && <span className="scw-note" role="status">{note}</span>}</p>
    </form>
  );
}
