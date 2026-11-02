// Preferences > Rules, the rule sheet and the Smart Mailbox sheet, which share the condition rows (docs/design/plans/mail-client.md, Rules, Smart Mailboxes).
import { useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { view } from "../../../sim/42-mail/model";
import type { MailCond, MailKind } from "../../../sim/42-mail/types";
import { MY_PEAR, type ClientAct, type ClientRule, type SmartCond, type SmartMailbox } from "../../../sim/43-pear-mail/state";
import { clientFolders, myFolders, type Row } from "../../../sim/43-pear-mail/view";
import { deleteClientRule, moveClientRule, saveClientRule, saveSmartMailbox } from "../../../sim/90-actions/pear-rules";
import { useStore } from "../../store";

type Field = SmartCond["field"];
const RULE_FIELDS: Field[] = ["from", "to", "subject", "kind", "size", "attachment"];
const SMART_FIELDS: Field[] = [...RULE_FIELDS, "account", "mailbox", "days", "unread", "flagged", "junk", "content"];
const TEXT_OPS: MailCond["op"][] = ["contains", "is", "starts", "ends"];
const KINDS: MailKind[] = ["support", "order", "notice", "licence", "invoice", "bank", "registrar", "authority", "host", "staff", "newsletter", "promotion", "spam", "bounce", "system", "reply", "alert"];
export const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "gray"];
const ACTS: ClientAct["do"][] = ["move", "copy", "color", "sound", "read", "star", "forward", "reply", "trash", "junk", "notJunk", "stop"];

// The comparisons a field offers; flags take none and Date Received counts days.
const opsOf = (f: Field): MailCond["op"][] => (f === "size" || f === "days" ? ["over"] : f === "kind" || f === "account" || f === "mailbox" ? ["is"] : ["unread", "flagged", "junk"].includes(f) ? [] : TEXT_OPS);
const blank = (f: Field): SmartCond => ({ field: f, op: opsOf(f)[0] ?? "is", value: f === "kind" ? "order" : f === "size" || f === "days" ? 1 : "" });

const Line = ({ label, children }: { label: string; children: ReactNode }) => <label className="pm-row"><span>{label}</span>{children}</label>;
function Plus({ onAdd, onRemove, last }: { onAdd: () => void; onRemove: () => void; last: boolean }) {
  return (
    <span className="pm-plusminus">
      <button type="button" className="btn" aria-label={t("pearMail.rule.removeRow")} disabled={last} onClick={onRemove}>−</button>
      <button type="button" className="btn" aria-label={t("pearMail.rule.addRow")} onClick={onAdd}>+</button>
    </span>
  );
}

function Value({ c, onChange }: { c: SmartCond; onChange: (v: string | number) => void }) {
  const game = useStore((s) => s.game);
  if (c.field === "kind") return <select className="field" value={c.value} onChange={(e) => onChange(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{t(`pearMail.kind.${k}`)}</option>)}</select>;
  if (c.field === "account") return <select className="field" value={c.value} onChange={(e) => onChange(e.target.value)}><option value="" />{game.pearMail.accounts.map((a) => <option key={a.id} value={a.id}>{a.description}</option>)}</select>;
  if (c.field === "mailbox") {
    const names = new Map([...game.pearMail.accounts.flatMap((a) => clientFolders(game, a)), ...myFolders(game)].map((f) => [f.id, f.name]));
    return <select className="field" value={c.value} onChange={(e) => onChange(e.target.value)}><option value="" />{[...names].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>;
  }
  if (c.field === "size" || c.field === "days") return <span className="pm-unit"><input className="field" type="number" min={0} value={c.value} onChange={(e) => onChange(Number(e.target.value))} />{t(c.field === "size" ? "pearMail.unit.kb" : "pearMail.unit.days")}</span>;
  if (!opsOf(c.field).length) return <span />;
  return <input className="field" value={c.value} onChange={(e) => onChange(e.target.value)} />;
}

export function Conditions<C extends SmartCond>({ conds, fields, onChange }: { conds: C[]; fields: Field[]; onChange: (c: C[]) => void }) {
  const set = (i: number, c: SmartCond) => onChange(conds.map((x, k) => (k === i ? c : x)) as C[]);
  return (
    <div className="pm-conds">
      {conds.map((c, i) => (
        <div key={i} className="pm-cond">
          <select className="field" aria-label={t("pearMail.rule.field")} value={c.field} onChange={(e) => set(i, blank(e.target.value as Field))}>
            {fields.map((f) => <option key={f} value={f}>{t(`pearMail.cond.${f}`)}</option>)}
          </select>
          {opsOf(c.field).length > 0 && (
            <select className="field" aria-label={t("pearMail.rule.op")} value={c.op} onChange={(e) => set(i, { ...c, op: e.target.value as MailCond["op"] })}>
              {opsOf(c.field).map((o) => <option key={o} value={o}>{t(c.field === "days" ? "pearMail.op.within" : `pearMail.op.${o}`)}</option>)}
            </select>
          )}
          <Value c={c} onChange={(value) => set(i, { ...c, value })} />
          <Plus last={conds.length === 1} onRemove={() => onChange(conds.filter((_, k) => k !== i))} onAdd={() => onChange([...conds.slice(0, i + 1), blank(fields[0]) as C, ...conds.slice(i + 1)])} />
        </div>
      ))}
    </div>
  );
}

function Match({ value, onChange, pre, post }: { value: "all" | "any"; onChange: (m: "all" | "any") => void; pre: string; post: string }) {
  return (
    <p className="pm-match">{pre}{" "}
      <select className="field" value={value} onChange={(e) => onChange(e.target.value as "all" | "any")}>
        <option value="any">{t("pearMail.match.any")}</option><option value="all">{t("pearMail.match.all")}</option>
      </select>{" "}{post}
    </p>
  );
}

function Act({ a, onChange }: { a: ClientAct; onChange: (a: ClientAct) => void }) {
  const game = useStore((s) => s.game);
  const pick = (d: ClientAct["do"]): ClientAct => (d === "move" || d === "copy" ? { do: d, folder: "inbox" } : d === "color" ? { do: d, color: "red" } : d === "forward" ? { do: d, to: "" }
    : d === "reply" ? { do: d, subject: "", text: "" } : { do: d } as ClientAct);
  const boxes = [
    ...[...new Map(game.pearMail.accounts.filter((c) => c.protocol === "imap").flatMap((c) => clientFolders(game, c)).map((f) => [f.id, f.name])).entries()],
    ...myFolders(game).map((f) => [`${MY_PEAR}:${f.id}`, `${t("pearMail.onMyPear")}: ${f.name}`] as [string, string]),
  ];
  return (
    <>
      <select className="field" aria-label={t("pearMail.rule.action")} value={a.do} onChange={(e) => onChange(pick(e.target.value as ClientAct["do"]))}>
        {ACTS.map((d) => <option key={d} value={d}>{t(`pearMail.act.${d}`)}</option>)}
      </select>
      {(a.do === "move" || a.do === "copy") && <select className="field" value={a.folder} onChange={(e) => onChange({ ...a, folder: e.target.value })}>{boxes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>}
      {a.do === "color" && <select className="field" value={a.color} onChange={(e) => onChange({ ...a, color: e.target.value })}>{COLORS.map((c) => <option key={c} value={c}>{t(`pearMail.color.${c}`)}</option>)}</select>}
      {a.do === "forward" && <input className="field" type="email" aria-label={t("pearMail.field.to")} value={a.to} onChange={(e) => onChange({ ...a, to: e.target.value })} />}
      {a.do === "reply" && <span className="pm-reply">
        <input className="field" aria-label={t("pearMail.field.subject")} value={a.subject} onChange={(e) => onChange({ ...a, subject: e.target.value })} />
        <textarea className="field" aria-label={t("pearMail.message")} value={a.text} onChange={(e) => onChange({ ...a, text: e.target.value })} />
      </span>}
    </>
  );
}

function Sheet({ title, error, onClose, onSave, children }: { title: string; error: string | null; onClose: () => void; onSave: () => void; children: ReactNode }) {
  return (
    <form className="pm-sheet pm-rule" role="dialog" aria-labelledby="pm-rule-title" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <h2 id="pm-rule-title">{title}</h2>
      {children}
      {error && <p className="pm-error" role="alert">{t(error)}</p>}
      <div className="pm-sheet-buttons">
        <span className="pm-grow" />
        <button type="button" className="btn" onClick={onClose}>{t("pearMail.cancel")}</button>
        <button type="submit" className="btn primary">{t("pearMail.ok")}</button>
      </div>
    </form>
  );
}

// A new rule from a message starts with its sender and subject.
export function RuleSheet({ rule, from, onClose }: { rule?: ClientRule; from?: Row; onClose: () => void }) {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt);
  const v = from && view(game, from.m);
  const [r, setR] = useState<Omit<ClientRule, "id"> & { id?: string }>(rule ?? {
    name: v ? v.subject : t("pearMail.rule.defaultName", { n: game.pearMail.rules.length + 1 }), on: true, match: v ? "all" : "any", clientId: null,
    conds: v ? [{ field: "from", op: "contains", value: v.fromAddress }, { field: "subject", op: "contains", value: v.subject }] : [{ field: "from", op: "contains", value: "" }],
    acts: [{ do: "move", folder: "inbox" }],
  });
  const [error, setError] = useState<string | null>(null);
  const save = () => { const x = attempt(saveClientRule, r); if (x.ok) onClose(); else setError(x.error ?? null); };
  return (
    <Sheet title={t("pearMail.rules")} error={error} onClose={onClose} onSave={save}>
      <div className="pm-form">
        <Line label={t("pearMail.rule.description")}><input className="field" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} autoFocus /></Line>
        <Line label={t("pearMail.info.account")}>
          <select className="field" value={r.clientId ?? ""} onChange={(e) => setR({ ...r, clientId: e.target.value || null })}>
            <option value="">{t("pearMail.rule.anyAccount")}</option>
            {game.pearMail.accounts.map((c) => <option key={c.id} value={c.id}>{c.description}</option>)}
          </select>
        </Line>
      </div>
      <Match value={r.match} onChange={(match) => setR({ ...r, match })} pre={t("pearMail.rule.ifPre")} post={t("pearMail.rule.ifPost")} />
      <Conditions conds={r.conds as SmartCond[]} fields={RULE_FIELDS} onChange={(conds) => setR({ ...r, conds: conds as MailCond[] })} />
      <p className="pm-match">{t("pearMail.rule.perform")}</p>
      <div className="pm-conds">
        {r.acts.map((a, i) => (
          <div key={i} className="pm-cond">
            <Act a={a} onChange={(x) => setR({ ...r, acts: r.acts.map((y, k) => (k === i ? x : y)) })} />
            <Plus last={r.acts.length === 1} onRemove={() => setR({ ...r, acts: r.acts.filter((_, k) => k !== i) })} onAdd={() => setR({ ...r, acts: [...r.acts.slice(0, i + 1), { do: "read" }, ...r.acts.slice(i + 1)] })} />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function SmartSheet({ smart, onClose }: { smart?: SmartMailbox; onClose: () => void }) {
  const attempt = useStore((s) => s.attempt);
  const [sm, setSm] = useState<Omit<SmartMailbox, "id"> & { id?: string }>(smart ?? { name: "", match: "all", conds: [{ field: "from", op: "contains", value: "" }], trash: false, sent: false });
  const [error, setError] = useState<string | null>(null);
  const save = () => { const x = attempt(saveSmartMailbox, sm); if (x.ok) onClose(); else setError(x.error ?? null); };
  return (
    <Sheet title={t("pearMail.smart.title")} error={error} onClose={onClose} onSave={save}>
      <div className="pm-form"><Line label={t("pearMail.smart.name")}><input className="field" value={sm.name} onChange={(e) => setSm({ ...sm, name: e.target.value })} autoFocus /></Line></div>
      <Match value={sm.match} onChange={(match) => setSm({ ...sm, match })} pre={t("pearMail.smart.pre")} post={t("pearMail.smart.post")} />
      <Conditions conds={sm.conds} fields={SMART_FIELDS} onChange={(conds) => setSm({ ...sm, conds })} />
      <label className="pm-check"><input type="checkbox" checked={sm.trash} onChange={(e) => setSm({ ...sm, trash: e.target.checked })} />{t("pearMail.smart.trash")}</label>
      <label className="pm-check"><input type="checkbox" checked={sm.sent} onChange={(e) => setSm({ ...sm, sent: e.target.checked })} />{t("pearMail.smart.sent")}</label>
    </Sheet>
  );
}

// Preferences > Rules: the list in the order rules run, with an enable checkbox each; rows drag to reorder.
export function RulesPane({ onEdit }: { onEdit: (r?: ClientRule) => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const rules = game.pearMail.rules;
  const [sel, setSel] = useState<string | null>(null);
  const picked = rules.find((r) => r.id === sel);
  return (
    <div className="pm-rules-row">
      <table className="table pm-rules">
        <thead><tr><th>{t("pearMail.rule.active")}</th><th>{t("pearMail.rule.name")}</th></tr></thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={r.id} className={sel === r.id ? "sel" : ""} onClick={() => setSel(r.id)} onDoubleClick={() => onEdit(r)}
              draggable onDragStart={(e) => e.dataTransfer.setData("application/x-pear-rule", r.id)} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("application/x-pear-rule"); if (id) act(moveClientRule, id, i); }}>
              <td><input type="checkbox" aria-label={r.name} checked={r.on} onChange={(e) => act(saveClientRule, { ...r, on: e.target.checked })} onClick={(e) => e.stopPropagation()} /></td>
              <td>{r.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pm-rules-buttons">
        <button className="btn" onClick={() => onEdit()}>{t("pearMail.rule.add")}</button>
        <button className="btn" disabled={!picked} onClick={() => picked && onEdit(picked)}>{t("pearMail.rule.edit")}</button>
        <button className="btn" disabled={!picked} onClick={() => { if (picked) { const { id: _i, ...copy } = picked; act(saveClientRule, { ...copy, name: t("pearMail.rule.copyName", { name: picked.name }) }); } }}>{t("pearMail.rule.duplicate")}</button>
        <button className="btn" disabled={!picked} onClick={() => { if (picked) { act(deleteClientRule, picked.id); setSel(null); } }}>{t("pearMail.remove")}</button>
      </div>
    </div>
  );
}
