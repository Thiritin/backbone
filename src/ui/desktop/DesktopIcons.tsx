import { BookOpen, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import type { Doc } from "../../sim/50-state";
import { addNote, editNote, moveDoc, removeDoc } from "../../sim/90-actions/docs";
import { useStore } from "../store";
import { Confirm } from "./Confirm";
import { menuOn, openMenu } from "./ContextMenu";

const ICON_W = 92, ICON_H = 90, MENUBAR = 30, DOCK = 80;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function newNote(at?: { x: number; y: number }) {
  const { act, openDoc } = useStore.getState();
  const r = act(addNote, at);
  if (r.ok && r.id) openDoc(r.id);
}


export function DesktopIcons() {
  const docs = useStore((s) => s.game.docs);
  const act = useStore((s) => s.act), openDoc = useStore((s) => s.openDoc);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [trash, setTrash] = useState<Doc | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const clear = () => setSelected(null);
    const context = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".wallpaper-host")) return;
      e.preventDefault();
      openMenu(e.clientX, e.clientY, [{ label: "New note", run: () => newNote({ x: e.clientX - ICON_W / 2, y: e.clientY - 32 }) }]);
    };
    window.addEventListener("pointerdown", clear);
    window.addEventListener("contextmenu", context);
    return () => { window.removeEventListener("pointerdown", clear); window.removeEventListener("contextmenu", context); };
  }, []);

  useEffect(() => {
    const doc = docs.find((d) => d.id === selected);
    if (!doc || renaming || trash) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as Element).closest("input, textarea, select, [role=alertdialog]")) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setTrash(doc); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [docs, selected, renaming, trash]);

  const grab = (e: RPointerEvent, d: Doc) => {
    e.stopPropagation();
    setSelected(d.id);
    if (e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    let pos: { x: number; y: number } | null = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!pos && Math.hypot(dx, dy) < 4) return;
      pos = { x: clamp(d.x + dx, 0, innerWidth - ICON_W), y: clamp(d.y + dy, MENUBAR, innerHeight - DOCK - ICON_H) };
      setDrag({ id: d.id, ...pos });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (pos) act(moveDoc, d.id, pos!.x, pos!.y);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const rename = (d: Doc, value: string) => {
    setRenaming(null);
    if (value.trim() && value.trim() !== d.title) act(editNote, d.id, { title: value });
  };

  const remove = (d: Doc) => {
    setTrash(null);
    const { windows, close } = useStore.getState();
    if (!act(removeDoc, d.id).ok) return;
    for (const w of windows) if (w.doc === d.id || (d.kind === "guide" && w.app === "Getting started")) close(w.id);
  };


  return (
    <div className="desktop-icons">
      {docs.map((d) => {
        const Icon = d.kind === "guide" ? BookOpen : FileText;
        const at = drag?.id === d.id ? drag : d;
        return (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            className={`desktop-icon${selected === d.id ? " selected" : ""}`}
            style={{ left: at.x, top: at.y }}
            onPointerDown={(e) => grab(e, d)}
            onDoubleClick={() => openDoc(d.id)}
            onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && openDoc(d.id)}
            onContextMenu={menuOn(() => [{ label: "Open", run: () => openDoc(d.id) }, { label: "Rename", run: () => setRenaming(d.id) }, null, { label: "Move to Trash", run: () => setTrash(d) }])}
          >
            <span className={`di-page di-${d.kind}`}><Icon /></span>
            {renaming === d.id ? (
              <input
                className="di-rename"
                aria-label="Title"
                defaultValue={d.title}
                maxLength={80}
                autoFocus
                onFocus={(e) => e.currentTarget.select()}
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") e.currentTarget.value = d.title;
                  if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                }}
                onBlur={(e) => rename(d, e.currentTarget.value)}
              />
            ) : <span className="di-label">{d.title}</span>}
          </div>
        );
      })}
      {trash && (
        <Confirm
          title={`Move “${trash.title}” to the Trash?`}
          text={trash.kind === "guide" ? "The guide is removed from the desktop." : "The note and its text are deleted."}
          action="Move to Trash"
          onCancel={() => setTrash(null)}
          onConfirm={() => remove(trash)}
        />
      )}
    </div>
  );
}
