import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { addNote, editNote, moveDoc, removeDoc, restoreGuide } from "../src/sim/90-actions/docs";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("desktop documents", () => {
  it("starts with the guide", () => {
    expect(newGame(3).docs).toEqual([{ id: "guide", kind: "guide", title: "Getting started", body: "", x: 16, y: 46 }]);
  });

  it("adds notes in free spots or where asked", () => {
    const s = newGame(3);
    const a = addNote(s), b = addNote(s, { x: 400.4, y: -20 });
    if (!a.ok || !b.ok) throw new Error("addNote failed");
    expect(s.docs.find((d) => d.id === a.id)).toMatchObject({ kind: "note", title: "Untitled", body: "", x: 16, y: 146 });
    expect(s.docs.find((d) => d.id === b.id)).toMatchObject({ x: 400, y: 0 });
    expect(a.id).not.toBe(b.id);
  });

  it("edits, moves and removes notes", () => {
    const s = newGame(3);
    const { id } = addNote(s) as { id: string };
    expect(editNote(s, id, { title: "  Rack plan  ", body: "buy a 42U" }).ok).toBe(true);
    expect(editNote(s, id, { title: " " })).toEqual({ ok: false, error: "error.emptyTitle" });
    expect(moveDoc(s, id, 300, 200).ok).toBe(true);
    expect(s.docs.find((d) => d.id === id)).toMatchObject({ title: "Rack plan", body: "buy a 42U", x: 300, y: 200 });
    expect(removeDoc(s, id).ok).toBe(true);
    expect(editNote(s, id, { body: "x" })).toEqual({ ok: false, error: "error.unknownDoc" });
    expect(removeDoc(s, id)).toEqual({ ok: false, error: "error.unknownDoc" });
  });

  it("removes and restores the guide", () => {
    const s = newGame(3);
    addNote(s, { x: 16, y: 46 });
    expect(removeDoc(s, "guide").ok).toBe(true);
    expect(restoreGuide(s).ok).toBe(true);
    expect(s.docs.find((d) => d.id === "guide")).toMatchObject({ kind: "guide", title: "Getting started", x: 16, y: 146 });
    expect(restoreGuide(s)).toEqual({ ok: false, error: "error.guideOnDesktop" });
  });

  it("saves notes and gives old saves the guide", () => {
    const s = newGame(5);
    const { id } = addNote(s) as { id: string };
    editNote(s, id, { body: "hello" });
    removeDoc(s, "guide");
    expect(deserialize(serialize(s)).docs).toEqual(s.docs);

    const old = JSON.parse(serialize(newGame(5)));
    delete old.docs;
    expect(deserialize(JSON.stringify(old)).docs).toEqual(newGame(5).docs);
  });
});
