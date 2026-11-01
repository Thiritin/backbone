import { hasModule } from "../../../sim/10-catalog/modules";
import { lexwearUrl } from "../../../sim/80-business/lexwear";
import { runModule } from "../../../sim/90-actions/lexwear";
import { useStore } from "../../store";

// A Lexwear module's button: it runs the module once registered, and opens the module's page on Lexwear's site before.
export function Locked({ id, label }: { id: string; label: string }) {
  const owned = useStore((s) => hasModule(s.game, id)), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  return owned
    ? <button className="btn" onClick={() => act(runModule, id)}>{label}</button>
    : <button className="btn books-locked" aria-disabled="true" onClick={() => openApp("Browser", { kind: "url", id: lexwearUrl(id) })}>{label}</button>;
}
