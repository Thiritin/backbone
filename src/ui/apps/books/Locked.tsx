import { modulePrice } from "../../../sim/10-catalog/bookkeeping";
import { hasModule } from "../../../sim/10-catalog/modules";
import { booksUrl, currentVendor } from "../../../sim/80-business/bookkeeping";
import { runModule } from "../../../sim/90-actions/lexwear";
import { useStore } from "../../store";

// A module's button: it runs the module once registered, opens the module's page on the vendor's site before, and is
// missing where the vendor never sells it.
export function Locked({ id, label }: { id: string; label: string }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const v = currentVendor(game);
  if (hasModule(game, id)) return <button className="btn" onClick={() => act(runModule, id)}>{label}</button>;
  if (!v || modulePrice(v, id) === "never") return null;
  return <button className="btn books-locked" aria-disabled="true" onClick={() => openApp("Browser", { kind: "url", id: booksUrl(v, id) })}>{label}</button>;
}
