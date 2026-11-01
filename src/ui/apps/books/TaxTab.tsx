import { useStore } from "../../store";
import { OpenReturns } from "../dohle/OpenReturns";

export function TaxTab() {
  const game = useStore((s) => s.game);
  return <div className="fin-scroll"><OpenReturns game={game} /></div>;
}
