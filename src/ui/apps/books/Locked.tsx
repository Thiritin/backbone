import { sells, type Feature } from "../../../sim/10-catalog/bookkeeping";
import { booksUrl, currentVendor, hasFeature } from "../../../sim/80-business/bookkeeping";
import { runFeature } from "../../../sim/90-actions/bookkeeping";
import { useStore } from "../../store";

// An edition feature's button: it runs the feature when the edition has it, opens the vendor's editions page when a larger
// edition has it, and is missing where the vendor never sells it.
export function Locked({ id, label }: { id: Feature; label: string }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const v = currentVendor(game);
  if (hasFeature(game, id)) return <button className="btn" onClick={() => act(runFeature, id)}>{label}</button>;
  if (!v || !sells(v, id)) return null;
  return <button className="btn books-locked" aria-disabled="true" onClick={() => openApp("Browser", { kind: "url", id: booksUrl(v) })}>{label}</button>;
}
