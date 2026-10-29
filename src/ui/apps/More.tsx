import { Ellipsis } from "lucide-react";
import { menuOn, type MenuEntry } from "../desktop/ContextMenu";

// The three-dot button that opens an object's context menu, for touchpads without a right click.
export function More({ label, entries }: { label: string; entries: () => MenuEntry[] }) {
  return <button className="btn ghost icon" aria-label={`Actions for ${label}`} aria-haspopup="menu" onClick={menuOn(entries)}><Ellipsis /></button>;
}
