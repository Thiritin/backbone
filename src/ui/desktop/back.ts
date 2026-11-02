import { useEffect, useRef } from "react";

const handlers = new Map<string, () => void>();

/** Lets the window with this id take over the browser's Back button while it is in front. */
export function useBack(id: string, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    handlers.set(id, () => ref.current());
    return () => void handlers.delete(id);
  }, [id]);
}

/** Keeps one history entry ahead so Back never leaves the game; the front window decides what it means. */
export function trapBack(win: Pick<Window, "history" | "addEventListener">, front: () => string | undefined) {
  win.history.pushState(null, "");
  win.addEventListener("popstate", () => {
    win.history.pushState(null, "");
    const id = front();
    if (id) handlers.get(id)?.();
  });
}
