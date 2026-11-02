import { useMemo, type KeyboardEvent } from "react";
import { booksView } from "../../../sim/80-business/shoplink";
import { useStore } from "../../store";

// Every Books tab reads the game through this, so records the shop has not handed over stay out of sight.
export function useBooks() {
  const game = useStore((s) => s.game);
  return useMemo(() => booksView(game), [game]);
}

// Up and Down step the selection through a list's rows by clicking the next one, unless a field has focus.
export function arrowRows(e: KeyboardEvent<HTMLElement>) {
  if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>("tbody tr[tabindex], .books-item")];
  const at = rows.findIndex((r) => r.contains(document.activeElement)), from = at >= 0 ? at : rows.findIndex((r) => r.matches(".sel, .active"));
  const next = rows[from + (e.key === "ArrowDown" ? 1 : -1)];
  if (!next) return;
  e.preventDefault();
  next.click();
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest" });
}
