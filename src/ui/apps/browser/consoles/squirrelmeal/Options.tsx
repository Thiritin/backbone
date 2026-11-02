import { useState } from "react";
import { foldersOf } from "../../../../../sim/42-mail/model";
import { selfHostCaps, subscribed, webmailOf, webmailPref, webmailUser, type Contact, type Identity } from "../../../../../sim/80-business/webmail";
import {
  deleteLocalFilter, removeContact, removeIdentity, saveContact, saveIdentity, saveLocalFilter, setFolderSubscribed, setWebmailPref,
} from "../../../../../sim/90-actions/webmail";
import { changePassword, deleteFilter, saveFilter } from "../../../../../sim/90-actions/mailbox";
import { createMailFolder, deleteMailFolder, renameMailFolder, setVacation } from "../../../../../sim/90-actions/mailmsg";
import { sieveScript } from "../../../../../sim/80-business/sieve";
import { t } from "../../../../../i18n/en";
import { FolderSelect, Link, Title, type Ctx } from "./Mailbox";

export const THEMES = ["default", "plainBlue", "sandStorm", "blackBean"] as const;
const FIELDS = ["from", "to", "subject"] as const;
type Field = (typeof FIELDS)[number];
const err = (r: { ok: boolean; error?: string }, done: string) => (r.ok ? t(done) : t(r.error ?? "error.mailUnknown"));
const Note = ({ text }: { text: string | null }) => (text ? <p className="smw-note">{text}</p> : null);
const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <table className="smw-box"><tbody><tr><th>{title}</th></tr><tr><td>{children}</td></tr></tbody></table>
);

// options.php: the index of option pages; a plugin that is switched off has no entry.
export function Options({ ctx, page }: { ctx: Ctx; page: string }) {
  const { game, c, go } = ctx, plugins = webmailOf(game, c).plugins;
  const pages = [
    "personal", "display", "folders",
    ...(plugins.includes("filters") ? ["filters"] : []),
    ...(plugins.includes("havelsieve") && selfHostCaps(game).sieve ? ["sieve"] : []),
    ...(plugins.includes("changepass") ? ["password"] : []),
  ];
  const back = <div className="smw-tools"><Link on={() => go({ k: "options", page: "" })}>{t("mailserver.sm.optionsBack")}</Link></div>;
  const body = page === "personal" ? <Personal ctx={ctx} /> : page === "display" ? <Display ctx={ctx} /> : page === "folders" ? <FolderPrefs ctx={ctx} />
    : page === "filters" ? <Filters ctx={ctx} /> : page === "sieve" ? <Sieve ctx={ctx} /> : page === "password" ? <Password ctx={ctx} /> : null;
  if (body && pages.includes(page)) return <><Title>{t(`mailserver.sm.opt.${page}`)}</Title>{body}{back}</>;
  return (
    <>
      <Title>{t("mailserver.sm.options")}</Title>
      <div className="smw-grid">
        {pages.map((p) => <Box key={p} title={t(`mailserver.sm.opt.${p}`)}><p><Link on={() => go({ k: "options", page: p })}>{t(`mailserver.sm.opt.${p}`)}</Link></p><p>{t(`mailserver.sm.optText.${p}`)}</p></Box>)}
      </div>
    </>
  );
}

function IdentityForm({ ctx, index, start }: { ctx: Ctx; index: number | null; start: Identity }) {
  const [id, setId] = useState(start), [note, setNote] = useState<string | null>(null);
  const field = (k: keyof Identity) => <tr><th>{t(`mailserver.sm.id.${k}`)}</th><td>{k === "signature" ? <textarea rows={4} value={id[k]} onChange={(e) => setId({ ...id, [k]: e.target.value })} /> : <input value={id[k]} onChange={(e) => setId({ ...id, [k]: e.target.value })} />}</td></tr>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const r = ctx.act(saveIdentity, ctx.c.id, ctx.account, index, id); setNote(err(r, "mailserver.sm.saved")); if (r.ok && index === null) setId({ name: "", email: "", replyTo: "", signature: "" }); }}>
      <table className="smw-head">
        <tbody>
          <tr><th colSpan={2} className="c">{t(index === 0 ? "mailserver.sm.defaultIdentity" : index === null ? "mailserver.sm.newIdentity" : "mailserver.sm.altIdentity")}</th></tr>
          {field("name")}{field("email")}{field("replyTo")}{field("signature")}
          <tr><td colSpan={2} className="c">
            <button type="submit">{t(index === null ? "mailserver.sm.add" : "mailserver.sm.submit")}</button>
            {index !== null && index > 0 && <button type="button" onClick={() => ctx.act(removeIdentity, ctx.c.id, ctx.account, index)}>{t("mailserver.sm.delete")}</button>}
          </td></tr>
        </tbody>
      </table>
      <Note text={note} />
    </form>
  );
}

function Personal({ ctx }: { ctx: Ctx }) {
  const u = webmailUser(ctx.game, ctx.c.id, ctx.account);
  return <>{u.identities.map((x, i) => <IdentityForm key={`${i}:${x.email}`} ctx={ctx} index={i} start={x} />)}<IdentityForm ctx={ctx} index={null} start={{ name: "", email: "", replyTo: "", signature: "" }} /></>;
}

function Display({ ctx }: { ctx: Ctx }) {
  const u = webmailUser(ctx.game, ctx.c.id, ctx.account);
  const [theme, setTheme] = useState(String(webmailPref(u, "theme"))), [per, setPer] = useState(String(webmailPref(u, "perPage"))), [note, setNote] = useState<string | null>(null);
  const submit = () => {
    ctx.act(setWebmailPref, ctx.c.id, ctx.account, "theme", theme);
    setNote(err(ctx.act(setWebmailPref, ctx.c.id, ctx.account, "perPage", Math.min(200, Math.max(1, Math.round(Number(per)) || 15))), "mailserver.sm.saved"));
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <table className="smw-head">
        <tbody>
          <tr><th>{t("mailserver.sm.theme")}</th><td><select value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((x) => <option key={x} value={x}>{t(`mailserver.sm.themes.${x}`)}</option>)}</select></td></tr>
          <tr><th>{t("mailserver.sm.perPage")}</th><td><input type="number" min={1} max={200} value={per} onChange={(e) => setPer(e.target.value)} /></td></tr>
          <tr><td colSpan={2} className="c"><button type="submit">{t("mailserver.sm.submit")}</button></td></tr>
        </tbody>
      </table>
      <Note text={note} />
    </form>
  );
}

function FolderPrefs({ ctx }: { ctx: Ctx }) {
  const u = webmailUser(ctx.game, ctx.c.id, ctx.account);
  const [trash, setTrash] = useState(String(webmailPref(u, "trash"))), [note, setNote] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); setNote(err(ctx.act(setWebmailPref, ctx.c.id, ctx.account, "trash", trash), "mailserver.sm.saved")); }}>
      <table className="smw-head">
        <tbody>
          <tr><th>{t("mailserver.sm.trashFolder")}</th><td><FolderSelect game={ctx.game} account={ctx.account} value={trash} set={setTrash} none={t("mailserver.sm.noTrash")} /></td></tr>
          <tr><td colSpan={2} className="c"><button type="submit">{t("mailserver.sm.submit")}</button></td></tr>
        </tbody>
      </table>
      <Note text={note} />
    </form>
  );
}

// A "<field> contains <text>, move to <folder>" form, shared by Message Filters and Havelsieve.
function RuleForm({ ctx, save }: { ctx: Ctx; save: (f: { field: Field; text: string; folder: string }) => { ok: boolean; error?: string } }) {
  const [f, setF] = useState<{ field: Field; text: string; folder: string }>({ field: "from", text: "", folder: "inbox" }), [note, setNote] = useState<string | null>(null);
  return (
    <form className="smw-tools" onSubmit={(e) => { e.preventDefault(); const r = save(f); setNote(r.ok ? null : t(r.error ?? "error.mailUnknown")); if (r.ok) setF({ ...f, text: "" }); }}>
      <span>{t("mailserver.sm.match")} <select value={f.field} onChange={(e) => setF({ ...f, field: e.target.value as Field })}>{FIELDS.map((x) => <option key={x} value={x}>{t(`mailserver.sm.scope.${x}`)}</option>)}</select></span>
      <span>{t("mailserver.sm.contains")} <input value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></span>
      <span>{t("mailserver.sm.moveToFolder")} <FolderSelect game={ctx.game} account={ctx.account} value={f.folder} set={(folder) => setF({ ...f, folder })} /></span>
      <button type="submit">{t("mailserver.sm.submit")}</button>
      <Note text={note} />
    </form>
  );
}

function Rules({ ctx, rules, remove }: { ctx: Ctx; rules: { id: string; conds: { field: string; value: string | number }[]; acts: { do: string; folder?: string }[] }[]; remove: (id: string) => void }) {
  const names = Object.fromEntries(foldersOf(ctx.game, ctx.account).map((f) => [f.id, f.name]));
  return (
    <table className="smw-list">
      <tbody>
        {rules.map((r, i) => (
          <tr key={r.id}><td>{i + 1}.</td><td>{t("mailserver.sm.rule", { field: t(`mailserver.sm.scope.${r.conds[0]?.field}`), text: String(r.conds[0]?.value ?? ""), folder: names[r.acts[0]?.folder ?? ""] ?? "" })}</td><td><Link on={() => remove(r.id)}>{t("mailserver.sm.delete")}</Link></td></tr>
        ))}
        {!rules.length && <tr><td className="c">{t("mailserver.sm.noRules")}</td></tr>}
      </tbody>
    </table>
  );
}

function Filters({ ctx }: { ctx: Ctx }) {
  const { act, c, account } = ctx, u = webmailUser(ctx.game, c.id, account);
  return <><Rules ctx={ctx} rules={u.localFilters as never} remove={(id) => act(deleteLocalFilter, c.id, account, id)} /><RuleForm ctx={ctx} save={(f) => act(saveLocalFilter, c.id, account, f)} /></>;
}

// Havelsieve: the rule table or the script it uploads, and the Vacation / Autoresponder rule.
function Sieve({ ctx }: { ctx: Ctx }) {
  const { act, account } = ctx, rules = ctx.game.mail.filters.filter((x) => x.accountId === account);
  const [source, setSource] = useState(false);
  const save = (f: { field: Field; text: string; folder: string }) => act(saveFilter, account, { name: f.text, on: true, match: "all", conds: [{ field: f.field, op: "contains", value: f.text.trim() }], acts: [{ do: "move", folder: f.folder }] });
  return (
    <>
      <div className="smw-tools"><Link on={() => setSource(!source)}>{t(source ? "mailserver.sm.showTable" : "mailserver.sm.showSource")}</Link></div>
      {source ? <pre className="smw-source">{sieveScript(ctx.game, account)}</pre> : <><Rules ctx={ctx} rules={rules as never} remove={(id) => act(deleteFilter, id)} /><RuleForm ctx={ctx} save={save} /></>}
      <Autoresponder ctx={ctx} />
    </>
  );
}

function Autoresponder({ ctx }: { ctx: Ctx }) {
  const v = ctx.game.mail.accounts.find((x) => x.id === ctx.account)?.vacation;
  const [f, setF] = useState({ on: !!v?.on, subject: v?.subject ?? "", text: v?.text ?? "" }), [note, setNote] = useState<string | null>(null);
  const submit = () => setNote(err(ctx.act(setVacation, ctx.account, { ...f, until: v?.until ?? null }), "mailserver.sm.vacation.saved"));
  return (
    <Box title={t("mailserver.sm.vacation.title")}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <table className="smw-head"><tbody>
          <tr><th>{t("mailserver.sm.vacation.on")}</th><td><input type="checkbox" checked={f.on} onChange={(e) => setF({ ...f, on: e.target.checked })} /></td></tr>
          <tr><th>{t("mailserver.sm.vacation.subject")}</th><td><input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></td></tr>
          <tr><th>{t("mailserver.sm.vacation.text")}</th><td><textarea rows={5} cols={50} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></td></tr>
          <tr><td colSpan={2} className="c"><button type="submit">{t("mailserver.sm.submit")}</button></td></tr>
        </tbody></table>
      </form>
      <Note text={note} />
    </Box>
  );
}

function Password({ ctx }: { ctx: Ctx }) {
  const [p, setP] = useState({ old: "", next: "", again: "" }), [note, setNote] = useState<string | null>(null);
  const submit = () => {
    if (p.next !== p.again) return setNote(t("mailserver.sm.pass.mismatch"));
    const r = ctx.act(changePassword, ctx.account, p.old, p.next);
    setNote(r.ok ? t("mailserver.sm.pass.done") : r.error === "error.mailLogin" ? t("mailserver.sm.pass.badOld") : t(r.error ?? "error.mailUnknown"));
    if (r.ok) setP({ old: "", next: "", again: "" });
  };
  const row = (k: keyof typeof p) => <tr><th>{t(`mailserver.sm.pass.${k}`)}</th><td><input type="password" autoComplete="off" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></td></tr>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <table className="smw-head"><tbody>{row("old")}{row("next")}{row("again")}<tr><td colSpan={2} className="c"><button type="submit">{t("mailserver.sm.submit")}</button></td></tr></tbody></table>
      <Note text={note} />
    </form>
  );
}

// folders.php: create, rename, delete, subscribe.
export function Folders({ ctx }: { ctx: Ctx }) {
  const { game, account, act } = ctx, custom = game.mail.folders.filter((f) => f.accountId === account && !f.label);
  const [name, setName] = useState(""), [parent, setParent] = useState(""), [ren, setRen] = useState(""), [renTo, setRenTo] = useState<string | null>(null);
  const [del, setDel] = useState(""), [sure, setSure] = useState(false), [note, setNote] = useState<string | null>(null);
  const on = custom.filter((f) => subscribed(game, account, f.id)), off = custom.filter((f) => !subscribed(game, account, f.id));
  const [subSel, setSubSel] = useState(""), [unsubSel, setUnsubSel] = useState("");
  const pick = (xs: typeof custom, v: string, set: (v: string) => void) => (
    <select value={v} onChange={(e) => set(e.target.value)}><option value="" />{xs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
  );
  const delName = custom.find((f) => f.id === del)?.name ?? "";
  return (
    <>
      <Title>{t("mailserver.sm.folders")}</Title>
      <Note text={note} />
      <Box title={t("mailserver.sm.createFolder")}>
        <form className="smw-tools" onSubmit={(e) => { e.preventDefault(); const r = act(createMailFolder, account, name, parent || null); setNote(err(r, "mailserver.sm.created")); if (r.ok) setName(""); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <span>{t("mailserver.sm.subfolderOf")} {pick(custom, parent, setParent)}</span>
          <button type="submit">{t("mailserver.sm.create")}</button>
        </form>
      </Box>
      <Box title={t("mailserver.sm.renameFolder")}>
        {renTo === null
          ? <div className="smw-tools">{pick(custom, ren, setRen)}<button type="button" disabled={!ren} onClick={() => setRenTo(custom.find((f) => f.id === ren)?.name ?? "")}>{t("mailserver.sm.rename")}</button></div>
          : <form className="smw-tools" onSubmit={(e) => { e.preventDefault(); const r = act(renameMailFolder, account, ren, renTo); setNote(err(r, "mailserver.sm.renamed")); if (r.ok) { setRenTo(null); setRen(""); } }}>
              <span>{t("mailserver.sm.renameTo")} <input value={renTo} onChange={(e) => setRenTo(e.target.value)} /></span>
              <button type="submit">{t("mailserver.sm.submit")}</button><button type="button" onClick={() => setRenTo(null)}>{t("mailserver.sm.cancel")}</button>
            </form>}
      </Box>
      <Box title={t("mailserver.sm.deleteFolder")}>
        {!sure
          ? <div className="smw-tools">{pick(custom, del, setDel)}<button type="button" disabled={!del} onClick={() => setSure(true)}>{t("mailserver.sm.delete")}</button></div>
          : <div className="smw-tools"><span>{t("mailserver.sm.deleteSure", { folder: delName })}</span>
              <button type="button" onClick={() => { setNote(err(act(deleteMailFolder, account, del), "mailserver.sm.deleted")); setSure(false); setDel(""); }}>{t("mailserver.sm.yes")}</button>
              <button type="button" onClick={() => setSure(false)}>{t("mailserver.sm.no")}</button></div>}
      </Box>
      <Box title={t("mailserver.sm.subscribe")}>
        <div className="smw-tools">
          <span>{pick(on, unsubSel, setUnsubSel)} <button type="button" disabled={!unsubSel} onClick={() => { act(setFolderSubscribed, account, unsubSel, false); setUnsubSel(""); }}>{t("mailserver.sm.unsubscribeBtn")}</button></span>
          <span>{pick(off, subSel, setSubSel)} <button type="button" disabled={!subSel} onClick={() => { act(setFolderSubscribed, account, subSel, true); setSubSel(""); }}>{t("mailserver.sm.subscribeBtn")}</button></span>
        </div>
      </Box>
    </>
  );
}

// addressbook.php: the personal address book.
export function Addresses({ ctx }: { ctx: Ctx }) {
  const { game, c, account, act } = ctx, u = webmailUser(game, c.id, account);
  const blank: Contact = { nick: "", name: "", email: "", info: "" };
  const [form, setForm] = useState(blank), [sel, setSel] = useState<string[]>([]), [note, setNote] = useState<string | null>(null);
  const field = (k: keyof Contact) => <tr key={k}><th>{t(`mailserver.sm.${k}`)}</th><td><input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></td></tr>;
  return (
    <>
      <Title>{t("mailserver.sm.personalBook")}</Title>
      <table className="smw-list">
        <thead><tr><th /><th>{t("mailserver.sm.nick")}</th><th>{t("mailserver.sm.name")}</th><th>{t("mailserver.sm.email")}</th><th>{t("mailserver.sm.info")}</th></tr></thead>
        <tbody>
          {u.contacts.map((x) => { const on = sel.includes(x.nick); return <tr key={x.nick}><td><input type="checkbox" checked={on} onChange={() => setSel(on ? sel.filter((n) => n !== x.nick) : [...sel, x.nick])} /></td><td>{x.nick}</td><td>{x.name}</td><td>{x.email}</td><td>{x.info}</td></tr>; })}
          {!u.contacts.length && <tr><td colSpan={5} className="c">{t("mailserver.sm.bookEmpty")}</td></tr>}
        </tbody>
      </table>
      <div className="smw-tools">
        <button type="button" disabled={!sel.length} onClick={() => { sel.forEach((n) => act(removeContact, c.id, account, n)); setSel([]); }}>{t("mailserver.sm.deleteSelected")}</button>
        <button type="button" disabled={sel.length !== 1} onClick={() => setForm(u.contacts.find((x) => x.nick === sel[0]) ?? blank)}>{t("mailserver.sm.editSelected")}</button>
      </div>
      <Title>{t("mailserver.sm.addToPersonal")}</Title>
      <form onSubmit={(e) => { e.preventDefault(); const r = act(saveContact, c.id, account, form); setNote(err(r, "mailserver.sm.saved")); if (r.ok) setForm(blank); }}>
        <table className="smw-head"><tbody>{(["nick", "email", "name", "info"] as const).map(field)}<tr><td colSpan={2} className="c"><button type="submit">{t("mailserver.sm.addAddress")}</button></td></tr></tbody></table>
        <Note text={note} />
      </form>
    </>
  );
}
