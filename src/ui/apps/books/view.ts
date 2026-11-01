import { useMemo } from "react";
import { booksView } from "../../../sim/80-business/shoplink";
import { useStore } from "../../store";

// Every Books tab reads the game through this, so records the shop has not handed over stay out of sight.
export function useBooks() {
  const game = useStore((s) => s.game);
  return useMemo(() => booksView(game), [game]);
}
