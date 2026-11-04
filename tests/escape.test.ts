// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeStep, type EscapeState } from "../src/ui/desktop/escape";

const win = (id: string, z: number, minimized = false) => ({ id, app: "Books", x: 0, y: 0, w: 1, h: 1, z, minimized, zoomed: false });
const state = (over: Partial<EscapeState> = {}, until = 0): EscapeState & { closed: string[]; room: number } => {
  const st = { closed: [] as string[], room: 0, game: { hour: 10, player: { until } } as EscapeState["game"], windows: [win("a", 1), win("b", 2)], close: (id: string) => void st.closed.push(id), setSurface: () => void st.room++ };
  return Object.assign(st, over);
};
const press = (target: Element, st: EscapeState, key = "Escape") => escapeStep({ key, target, defaultPrevented: false }, st);
afterEach(() => { document.body.innerHTML = ""; });

describe("Escape on the desktop", () => {
  it("closes the front window, then the next, then returns to the room", () => {
    const st = state();
    expect(press(document.body, st)).toBe("close");
    st.windows = st.windows.slice(0, 1);
    expect(press(document.body, st)).toBe("close");
    st.windows = [];
    expect(press(document.body, st)).toBe("room");
    expect(st.closed).toEqual(["b", "a"]);
    expect(st.room).toBe(1);
  });

  it("ignores minimized windows and other keys", () => {
    const st = state({ windows: [win("a", 1), win("b", 2, true)] });
    expect(press(document.body, st, "Enter")).toBeNull();
    press(document.body, st);
    expect(st.closed).toEqual(["a"]);
  });

  it("only blurs a field that is being typed in", () => {
    document.body.innerHTML = "<form><input id=f></form>";
    const input = document.getElementById("f") as HTMLInputElement;
    input.focus();
    const st = state();
    expect(press(input, st)).toBe("blur");
    expect(document.activeElement).not.toBe(input);
    expect(st.closed).toEqual([]);
  });

  it("leaves a field in edit mode, a select and a textarea to blur only", () => {
    document.body.innerHTML = "<textarea id=t></textarea><select id=s></select><div id=e contenteditable=true></div>";
    const st = state();
    for (const id of ["t", "s", "e"]) expect(press(document.getElementById(id)!, st)).toBe("blur");
    expect(st.closed).toEqual([]);
  });

  it("leaves dialogs, menus and screens to their own Escape", () => {
    document.body.innerHTML = "<div role=application id=a><button id=b></button></div>";
    const st = state();
    expect(press(document.getElementById("b")!, st)).toBeNull();
    document.body.innerHTML = "<div role=dialog></div><p id=p></p>";
    expect(press(document.getElementById("p")!, st)).toBeNull();
    expect(st.closed).toEqual([]);
  });

  it("does nothing while the player is busy walking", () => {
    const st = state({}, 50);
    expect(press(document.body, st)).toBeNull();
    expect(st.closed).toEqual([]);
    expect(st.room).toBe(0);
  });

  it("skips an Escape another handler already took", () => {
    const st = state();
    const spy = vi.fn();
    expect(escapeStep({ key: "Escape", target: document.body, defaultPrevented: true }, { ...st, close: spy })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
