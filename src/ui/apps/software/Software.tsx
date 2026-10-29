import type { LucideIcon } from "lucide-react";
import "./software.css";

// A square action button with its icon above the label, sized like the software tiles.
export function ActionTile({ icon: Icon, label, disabled, onClick }: { icon: LucideIcon; label: string; disabled?: boolean; onClick: () => void }) {
  return <button className="sw-tile act-tile" disabled={disabled} onClick={onClick}><Icon size={22} /><span className="t">{label}</span></button>;
}
