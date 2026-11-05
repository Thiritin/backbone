import { useEffect, useRef, useState } from "react";
import { editNote } from "../../sim/90-actions/docs";
import { useStore } from "../store";
import { t } from "../../i18n/en";
import { FormDoc } from "./FormDoc";

const SAVE_MS = 400;
const useDoc = (id: string) => useStore((s) => s.game.docs.find((d) => d.id === id));

// Saves the body a moment after typing stops, and on close.
export function NoteApp({ id }: { id: string }) {
  const doc = useDoc(id);
  const [body, setBody] = useState(doc?.body ?? "");
  const pending = useRef<string | null>(null);

  const flush = () => {
    const text = pending.current;
    pending.current = null;
    const { game, act } = useStore.getState();
    if (text !== null && game.docs.some((d) => d.id === id)) act(editNote, id, { body: text });
  };

  useEffect(() => {
    if (pending.current === null) return;
    const timer = setTimeout(flush, SAVE_MS);
    return () => clearTimeout(timer);
  }, [body]);
  useEffect(() => flush, []);

  if (!doc) return null;
  if (doc.form) return <FormDoc doc={doc} />;
  // The bank's TAN list is printed: it shows the list as it stands and takes no typing.
  const printed = id === "tans";
  if (printed) return <TanSheet />;
  return (
    <textarea
      className="note-body"
      aria-label={doc.title}
      value={printed ? doc.body : body}
      readOnly={printed}
      spellCheck
      onChange={(e) => { pending.current = e.target.value; setBody(e.target.value); }}
    />
  );
}

// The printed TAN list as a grid read down the columns; the code the bank asks for next is marked and scrolled into view.
function TanSheet() {
  const b = useStore((s) => s.game.bank), mark = useRef<HTMLElement>(null);
  const next = b ? (b.pending?.index ?? b.tans.codes.findIndex((_, i) => !b.tans.used.includes(i))) : -1;
  useEffect(() => { mark.current?.scrollIntoView?.({ block: "start" }); }, [next]);
  if (!b) return null;
  const rows = Math.ceil(b.tans.codes.length / 4);
  return (
    <div className="note-body tan-sheet" aria-label={t("doc.tans")}>
      <div className="tan-grid" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {b.tans.codes.map((c, i) => (
          <span key={i} ref={i === next ? mark : undefined} className={`tan-cell${i === next ? " now" : ""}${b.tans.used.includes(i) ? " used" : ""}`}>
            <i>{String(i + 1).padStart(3, "0")}</i>{b.tans.used.includes(i) ? "------" : c}
          </span>
        ))}
      </div>
    </div>
  );
}

// The note's title in its window bar; an emptied title falls back to the saved one on blur.
export function NoteTitle({ id }: { id: string }) {
  const doc = useDoc(id), act = useStore((s) => s.act);
  const [draft, setDraft] = useState<string | null>(null);
  if (!doc) return null;
  return (
    <input
      className="note-title"
      aria-label={t("apps.note.title")}
      maxLength={80}
      readOnly={id === "tans" || !!doc.form}
      value={draft ?? doc.title}
      size={Math.max(4, (draft ?? doc.title).length)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        setDraft(e.target.value);
        if (e.target.value.trim()) act(editNote, id, { title: e.target.value });
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
    />
  );
}
