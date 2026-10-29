import { useEffect, useRef, useState } from "react";
import { editNote } from "../../sim/90-actions/docs";
import { useStore } from "../store";

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
  return (
    <textarea
      className="note-body"
      aria-label={doc.title}
      value={body}
      spellCheck
      onChange={(e) => { pending.current = e.target.value; setBody(e.target.value); }}
    />
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
      aria-label="Title"
      maxLength={80}
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
