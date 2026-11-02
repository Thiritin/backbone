import { useState } from "react";
import { dateOf, hourOf } from "../../../../../sim/00-core/time";
import { protectedHost } from "../../../../../sim/42-mail/deliver";
import { foldersOf, tenantOf } from "../../../../../sim/42-mail/model";
import type { MailAct, MailCond, MailRule } from "../../../../../sim/42-mail/types";
import { matchPattern, sieveScript, toPattern } from "../../../../../sim/80-business/sieve";
import { deleteFilter, saveFilter, setFilterOn } from "../../../../../sim/90-actions/mailbox";
import { saveSieveScript, setVacation } from "../../../../../sim/90-actions/mailmsg";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import type { Ctx } from "./Mail";

type Field = MailCond["field"];
type Cond = { field: Field; op: "contains" | "is" | "matches" | "over"; value: string };
type Act = { do: "fileinto" | "redirect" | "addflags" | "stop"; target: string };
interface Form { id?: string; name: string; off: boolean; match: "all" | "any"; conds: Cond[]; acts: Act[] }

const FIELDS: Field[] = ["subject", "from", "to", "size"];
const ACTS: Act["do"][] = ["fileinto", "redirect", "addflags", "stop"];
const blank = (): Form => ({ name: "", off: false, match: "all", conds: [{ field: "subject", op: "contains", value: "" }], acts: [{ do: "fileinto", target: "inbox" }] });

const toForm = (r: MailRule): Form => ({
  id: r.id, name: r.name, off: !r.on, match: r.match,
  conds: r.conds.map((c) => ({ field: c.field, op: c.op === "starts" || c.op === "ends" ? "matches" : c.op, value: toPattern(c) })),
  acts: r.acts.map((a): Act => a.do === "move" ? { do: "fileinto", target: a.folder } : a.do === "trash" || a.do === "junk" ? { do: "fileinto", target: a.do }
    : a.do === "forward" ? { do: "redirect", target: a.to } : a.do === "read" || a.do === "star" ? { do: "addflags", target: a.do } : { do: "stop", target: "" }),
});

function toRule(f: Form): Omit<MailRule, "id"> | null {
  const conds: MailCond[] = [];
  for (const c of f.conds) {
    if (c.field === "size") { const n = Math.round(Number(c.value)); if (!(n > 0)) return null; conds.push({ field: "size", op: "over", value: n }); continue; }
    const m = c.op === "matches" ? matchPattern(c.value) : c.value.trim() ? { op: c.op as "contains" | "is", value: c.value.trim() } : null;
    if (!m) return null;
    conds.push({ field: c.field, ...m });
  }
  const acts = f.acts.map((a): MailAct => a.do === "stop" ? { do: "stop" } : a.do === "redirect" ? { do: "forward", to: a.target.trim() }
    : a.do === "addflags" ? { do: a.target === "star" ? "star" : "read" } : a.target === "trash" || a.target === "junk" ? { do: a.target } : { do: "move", folder: a.target });
  return { name: f.name.trim(), on: !f.off, match: f.match, conds, acts };
}

// Settings, Filters: the managesieve plugin with the filter list, the filter form and Edit filter set for the raw script.
export function Filters({ ctx }: { ctx: Ctx }) {
  const { game, account } = ctx, act = useStore((x) => x.attempt), rules = game.mail.filters.filter((x) => x.accountId === account);
  const folders = foldersOf(game, account).filter((x) => !x.label);
  const [form, setForm] = useState<Form | null>(null), [raw, setRaw] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = (f: Form | null) => { setForm(f); setRaw(null); setNote(null); setError(null); };
  const save = () => {
    if (!form) return;
    if (!form.name.trim()) return setError(t("mailserver.sc.cannotBeEmpty"));
    const rule = toRule(form), r = rule ? act(saveFilter, account, { ...rule, ...(form.id && { id: form.id }) }) : null;
    if (!r?.ok) return setError(t(r && !r.ok && r.error === "error.mailFilterMax" ? r.error : "mailserver.sc.filterSaveError"));
    setForm({ ...form, id: r.id }); setError(null); setNote(t("mailserver.sc.filterSaved"));
  };
  const saveRaw = () => {
    const r = act(saveSieveScript, account, raw ?? "");
    if (r.ok) { setError(null); setNote(t("mailserver.sc.filterSaved")); }
    else { setNote(null); setError(`${t("mailserver.sc.filterSaveError")}\n${t(r.error, r.params)}`); }
  };
  const remove = () => {
    if (!form?.id || !window.confirm(t("mailserver.sc.filterDeleteConfirm"))) return;
    act(deleteFilter, form.id); setForm(null); setNote(t("mailserver.sc.filterDeleted"));
  };
  const cond = (c: Cond, i: number) => {
    const set = (p: Partial<Cond>) => setForm({ ...form!, conds: form!.conds.map((x, j) => (j === i ? { ...x, ...p } : x)) });
    return (
      <tr key={i}><td>
        <select aria-label={t("mailserver.sc.ruleHeader")} value={c.field} onChange={(e) => { const field = e.target.value as Field; set({ field, op: field === "size" ? "over" : c.op === "over" ? "contains" : c.op }); }}>
          {FIELDS.map((x) => <option key={x} value={x}>{t(`mailserver.sc.field.${x}`)}</option>)}
        </select>{" "}
        <select aria-label={t("mailserver.sc.ruleOp")} value={c.op} onChange={(e) => set({ op: e.target.value as Cond["op"] })}>
          {(c.field === "size" ? ["over"] : ["contains", "is", "matches"]).map((x) => <option key={x} value={x}>{t(`mailserver.sc.op.${x}`)}</option>)}
        </select>{" "}
        <input aria-label={t("mailserver.sc.ruleValue")} value={c.value} onChange={(e) => set({ value: e.target.value })} />{c.field === "size" && " KB"}{" "}
        <button type="button" title={t("mailserver.sc.addRule")} disabled={form!.conds.length >= 5} onClick={() => setForm({ ...form!, conds: [...form!.conds.slice(0, i + 1), { field: "subject", op: "contains", value: "" }, ...form!.conds.slice(i + 1)] })}>+</button>
        <button type="button" title={t("mailserver.sc.delRule")} disabled={form!.conds.length < 2} onClick={() => setForm({ ...form!, conds: form!.conds.filter((_, j) => j !== i) })}>-</button>
      </td></tr>
    );
  };
  const action = (a: Act, i: number) => {
    const set = (p: Partial<Act>) => setForm({ ...form!, acts: form!.acts.map((x, j) => (j === i ? { ...x, ...p } : x)) });
    const pick = (d: Act["do"]) => set({ do: d, target: d === "fileinto" ? "inbox" : d === "addflags" ? "read" : "" });
    return (
      <tr key={i}><td>
        <select aria-label={t("mailserver.sc.ruleAction")} value={a.do} onChange={(e) => pick(e.target.value as Act["do"])}>
          {ACTS.map((x) => <option key={x} value={x}>{t(`mailserver.sc.do.${x}`)}</option>)}
        </select>{" "}
        {a.do === "fileinto" && <select aria-label={t("mailserver.sc.do.fileinto")} value={a.target} onChange={(e) => set({ target: e.target.value })}>{folders.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        {a.do === "redirect" && <input aria-label={t("mailserver.sc.do.redirect")} type="email" value={a.target} onChange={(e) => set({ target: e.target.value })} />}
        {a.do === "addflags" && <select aria-label={t("mailserver.sc.do.addflags")} value={a.target} onChange={(e) => set({ target: e.target.value })}>{["read", "star"].map((x) => <option key={x} value={x}>{t(`mailserver.sc.flag.${x}`)}</option>)}</select>}{" "}
        <button type="button" title={t("mailserver.sc.addAction")} disabled={form!.acts.length >= 5} onClick={() => setForm({ ...form!, acts: [...form!.acts.slice(0, i + 1), { do: "fileinto", target: "inbox" }, ...form!.acts.slice(i + 1)] })}>+</button>
        <button type="button" title={t("mailserver.sc.delAction")} disabled={form!.acts.length < 2} onClick={() => setForm({ ...form!, acts: form!.acts.filter((_, j) => j !== i) })}>-</button>
      </td></tr>
    );
  };
  return (
    <div className="scw-split">
      <aside>
        <div className="scw-toolbar">
          <button onClick={() => open(blank())}>{t("mailserver.sc.filterAdd")}</button>
          <button disabled={!form?.id} onClick={remove}>{t("mailserver.sc.filterDel")}</button>
          <button onClick={() => { open(null); setRaw(sieveScript(game, account)); }}>{t("mailserver.sc.filterSetEdit")}</button>
        </div>
        <table className="scw-list"><tbody>
          {rules.map((x) => (
            <tr key={x.id} className={`${form?.id === x.id ? "on" : ""}${x.on ? "" : " off"}`} onClick={() => open(toForm(x))}>
              <td>{x.name}</td>
              <td className="icon"><input type="checkbox" aria-label={t("mailserver.sc.filterEnabled")} checked={x.on} onClick={(e) => e.stopPropagation()} onChange={(e) => act(setFilterOn, x.id, e.target.checked)} /></td>
            </tr>
          ))}
        </tbody></table>
      </aside>
      {raw !== null && (
        <form className="scw-pane" onSubmit={(e) => { e.preventDefault(); saveRaw(); }}>
          <fieldset><legend>{t("mailserver.sc.filterSetEdit")}</legend>
            <textarea className="scw-raw" aria-label={t("mailserver.sc.filterSetEdit")} spellCheck={false} value={raw} onChange={(e) => setRaw(e.target.value)} />
          </fieldset>
          {error && <p className="scw-error-line" role="alert">{error}</p>}
          <p><button type="submit">{t("mailserver.sc.save")}</button> {note && <span className="scw-note" role="status">{note}</span>}</p>
        </form>
      )}
      {form && (
        <form className="scw-pane" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <table className="scw-form"><tbody>
            <tr><th><label htmlFor="scf-name">{t("mailserver.sc.filterName")}</label></th><td><input id="scf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></td></tr>
            <tr><th><label htmlFor="scf-off">{t("mailserver.sc.filterDisabled")}</label></th><td><input id="scf-off" type="checkbox" checked={form.off} onChange={(e) => setForm({ ...form, off: e.target.checked })} /></td></tr>
          </tbody></table>
          <fieldset><legend>{t("mailserver.sc.forIncoming")}</legend>
            {(["all", "any"] as const).map((m) => <label key={m} className="scw-radio"><input type="radio" name="scf-match" checked={form.match === m} onChange={() => setForm({ ...form, match: m })} /> {t(`mailserver.sc.match.${m}`)}</label>)}
            <table className="scw-form"><tbody>{form.conds.map(cond)}</tbody></table>
          </fieldset>
          <fieldset><legend>{t("mailserver.sc.thenDo")}</legend><table className="scw-form"><tbody>{form.acts.map(action)}</tbody></table></fieldset>
          {error && <p className="scw-error-line" role="alert">{error}</p>}
          <p><button type="submit">{t("mailserver.sc.save")}</button> {note && <span className="scw-note" role="status">{note}</span>}</p>
        </form>
      )}
      {!form && raw === null && note && <div className="scw-pane"><span className="scw-note" role="status">{note}</span></div>}
    </div>
  );
}

const iso = (hour: number) => dateOf(hour).toISOString().slice(0, 10);

// Settings, Out of Office: the managesieve vacation responder; the end date is the last day away.
export function Vacation({ ctx }: { ctx: Ctx }) {
  const { game, account } = ctx, act = useStore((x) => x.attempt), a = game.mail.accounts.find((x) => x.id === account)!, v = a.vacation;
  const t0 = tenantOf(game, a), weekly = !!t0 && protectedHost(game, t0);
  const [f, setF] = useState({ subject: v?.subject ?? "", text: v?.text ?? "", end: v?.until ? iso(v.until - 1) : "", on: v ? v.on : true });
  const [note, setNote] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const save = () => {
    const until = f.end ? hourOf(new Date(`${f.end}T00:00:00Z`)) + 24 : null;
    const r = act(setVacation, account, { on: f.on, subject: f.subject, text: f.text, until });
    setNote(r.ok ? t("mailserver.sc.vacSaved") : null); setError(r.ok ? null : t(r.error));
  };
  return (
    <form className="scw-pane" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset><legend>{t("mailserver.sc.vacTitle")}</legend><table className="scw-form"><tbody>
        <tr><th><label htmlFor="scv-subject">{t("mailserver.sc.vacSubject")}</label></th><td><input id="scv-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></td></tr>
        <tr><th><label htmlFor="scv-body">{t("mailserver.sc.vacBody")}</label></th><td><textarea id="scv-body" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></td></tr>
        <tr><th><label htmlFor="scv-end">{t("mailserver.sc.vacEnd")}</label></th><td><input id="scv-end" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></td></tr>
        <tr><th><label htmlFor="scv-status">{t("mailserver.sc.vacStatus")}</label></th><td>
          <select id="scv-status" value={f.on ? "on" : "off"} onChange={(e) => setF({ ...f, on: e.target.value === "on" })}><option value="on">{t("mailserver.sc.vacOn")}</option><option value="off">{t("mailserver.sc.vacOff")}</option></select>
        </td></tr>
        {weekly && <tr><th>{t("mailserver.sc.vacInterval")}</th><td>{t("mailserver.sc.vacDays", { n: "7" })}</td></tr>}
      </tbody></table></fieldset>
      {error && <p className="scw-error-line" role="alert">{error}</p>}
      <p><button type="submit">{t("mailserver.sc.save")}</button> {note && <span className="scw-note" role="status">{note}</span>}</p>
    </form>
  );
}
