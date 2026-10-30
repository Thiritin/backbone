import { Download } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { latestOs } from "../../sim/10-catalog/os";
import { updateOs } from "../../sim/90-actions/os";
import { useStore } from "../store";

// Offers a new Pear OS release once it is out; Later hides it until the next reload.
export function OsUpdateSheet() {
  const hour = useStore((s) => s.game.hour), os = useStore((s) => s.game.os), act = useStore((s) => s.act);
  const [later, setLater] = useState<string | null>(null);
  const next = latestOs(hour);
  if (next.id === os || next.id === later) return null;
  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert os-update" role="alertdialog" aria-modal="true" aria-labelledby="os-title" aria-describedby="os-text">
        <span className="alert-icon"><Download /></span>
        <h2 id="os-title">Software Update</h2>
        <p id="os-text">Pear OS {next.version} {next.name} is available for your computer.</p>
        <div className="alert-actions">
          <button className="btn" onClick={() => setLater(next.id)}>Later</button>
          <button className="btn primary" autoFocus onClick={() => act(updateOs)}>Update</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
