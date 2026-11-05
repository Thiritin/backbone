import { sells, type Feature } from "../../../../../../sim/10-catalog/bookkeeping";
import { booksUrl, currentVendor, hasFeature } from "../../../../../../sim/80-business/bookkeeping";
import { runFeature } from "../../../../../../sim/90-actions/bookkeeping";
import { useStore } from "../../../../../store";

// The vendor's page for the cheapest edition that has one of the features.
export const editionsUrl = (f: Feature[], game: Parameters<typeof currentVendor>[0]): string => {
  const v = currentVendor(game)!;
  return booksUrl(v, v.editions.find((e) => f.some((x) => e.features.includes(x)))?.id);
};

// A button that works when the edition has the feature (run runs it, else onClick), and opens the vendor's edition page when a larger edition has it.
export function Gated({ feature, label, onClick, run }: { feature: Feature; label: string; onClick?: () => void; run?: boolean }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp), v = currentVendor(game);
  if (hasFeature(game, feature)) return <button type="button" className="sx-btn" onClick={() => (run ? act(runFeature, feature) : onClick?.())}>{label}</button>;
  if (!v || !sells(v, feature)) return null;
  return <button type="button" className="sx-btn books-locked" aria-disabled="true" onClick={() => openApp("Browser", { kind: "url", id: editionsUrl([feature], game) })}>{label}</button>;
}
