import { useState } from "react";
import { foldersOf } from "../../../../../sim/42-mail/model";
import type { Folder } from "../../../../../sim/42-mail/types";
import { subscribed } from "../../../../../sim/80-business/webmail";
import { createMailFolder, deleteMailFolder, moveMailFolder, renameMailFolder } from "../../../../../sim/90-actions/mailmsg";
import { setFolderSubscribed } from "../../../../../sim/90-actions/webmail";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import type { Ctx } from "./Mail";

const DRAG = "application/x-squarecube-folder";

// Settings, Folders: every folder with its subscription box; a custom folder opens the name and parent form and drags onto a new parent.
export function Folders({ ctx }: { ctx: Ctx }) {
  const { game, account } = ctx, act = useStore((x) => x.attempt);
  const all = foldersOf(game, account).filter((x) => !x.label), custom = all.filter((x) => game.mail.folders.includes(x));
  const rows: { f: Folder; depth: number }[] = [];
  const add = (f: Folder, depth: number) => { rows.push({ f, depth }); for (const c of custom.filter((x) => x.parent === f.id).sort((a, b) => a.name.localeCompare(b.name))) add(c, depth + 1); };
  for (const f of all.filter((x) => !custom.includes(x) && x.id !== "archive")) add(f, 0);
  for (const f of custom.filter((x) => !x.parent).sort((a, b) => a.name.localeCompare(b.name))) add(f, 0);
  const [form, setForm] = useState<{ id: string | null; name: string; parent: string } | null>(null), [note, setNote] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const done = (r: { ok: boolean; error?: string }, ok: string) => { setNote(t(r.ok ? ok : r.error ?? "error.mailNoFolder")); return r.ok; };
  const below = (id: string): string[] => [id, ...custom.filter((x) => x.parent === id).flatMap((x) => below(x.id))];
  const save = () => {
    if (!form) return;
    const parent = form.parent || null;
    if (!form.id) { const r = act(createMailFolder, account, form.name, parent); if (done(r, "mailserver.sc.folderCreated") && r.ok) setForm({ ...form, id: r.id! }); return; }
    const f = custom.find((x) => x.id === form.id)!;
    if (f.name !== form.name.trim() && !done(act(renameMailFolder, account, f.id, form.name), "mailserver.sc.saved")) return;
    if (f.parent !== parent) done(act(moveMailFolder, account, f.id, parent), "mailserver.sc.saved");
    else setNote(t("mailserver.sc.saved"));
  };
  const remove = () => {
    if (!form?.id || !window.confirm(t("mailserver.sc.folderDeleteConfirm"))) return;
    if (done(act(deleteMailFolder, account, form.id), "mailserver.sc.folderDeleted")) setForm(null);
  };
  const drop = (e: React.DragEvent, parent: string | null) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData(DRAG);
    if (id && id !== parent) done(act(moveMailFolder, account, id, parent), "mailserver.sc.saved");
  };
  const target = (id: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); setOver(id ?? ""); } },
    onDragLeave: () => setOver(null), onDrop: (e: React.DragEvent) => drop(e, id),
  });
  return (
    <div className="scw-split">
      <aside>
        <div className="scw-toolbar">
          <button onClick={() => { setForm({ id: null, name: "", parent: "" }); setNote(null); }}>{t("mailserver.sc.folderCreate")}</button>
          <button disabled={!form?.id} onClick={remove}>{t("mailserver.sc.delete")}</button>
        </div>
        <table className="scw-list">
          <thead><tr className={over === "" ? "over" : ""} {...target(null)}><th>{t("mailserver.sc.folderName")}</th><th>{t("mailserver.sc.subscribed")}</th></tr></thead>
          <tbody>
            {rows.map(({ f, depth }) => {
              const own = custom.includes(f);
              return (
                <tr key={f.id} className={`${form?.id === f.id ? "on" : ""}${over === f.id ? " over" : ""}`} draggable={own}
                  onDragStart={(e) => e.dataTransfer.setData(DRAG, f.id)} {...(own ? target(f.id) : {})}
                  onClick={() => { if (own) { setForm({ id: f.id, name: f.name, parent: f.parent ?? "" }); setNote(null); } }}>
                  <td style={{ paddingLeft: 6 + depth * 14 }}>{f.name}</td>
                  <td className="icon"><input type="checkbox" aria-label={t("mailserver.sc.subscribed")} disabled={f.id === "inbox"} checked={subscribed(game, account, f.id)}
                    onClick={(e) => e.stopPropagation()} onChange={(e) => act(setFolderSubscribed, account, f.id, e.target.checked)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </aside>
      <div className="scw-pane">
        {form && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <table className="scw-form"><tbody>
              <tr><th><label htmlFor="scd-name">{t("mailserver.sc.folderName")}</label></th><td><input id="scd-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></td></tr>
              <tr><th><label htmlFor="scd-parent">{t("mailserver.sc.parentFolder")}</label></th><td>
                <select id="scd-parent" value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
                  <option value="">---</option>
                  {custom.filter((x) => !form.id || !below(form.id).includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </td></tr>
            </tbody></table>
            <p><button type="submit">{t("mailserver.sc.save")}</button></p>
          </form>
        )}
        {note && <span className="scw-note" role="status">{note}</span>}
      </div>
    </div>
  );
}
