import { Download, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Speed } from "../../sim/00-core/time";
import { latestOs, type OsRelease } from "../../sim/10-catalog/os";
import { updateOs } from "../../sim/90-actions/os";
import { useStore } from "../store";

const INSTALL_MS = 8000;

// Offers a new Pear OS release once it is out; Later hides it until the next reload.
export function OsUpdateSheet() {
  const hour = useStore((s) => s.game.hour), os = useStore((s) => s.game.os);
  const [later, setLater] = useState<string | null>(null);
  const [installing, setInstalling] = useState<OsRelease | null>(null);
  const resume = useRef<Speed>(0);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector(".desktop")), []);
  if (!host) return null;
  if (installing) return <Install release={installing} host={host} onDone={() => { setInstalling(null); useStore.getState().setSpeed(resume.current); }} />;
  const next = latestOs(hour);
  if (next.id === os || next.id === later) return null;
  const start = () => {
    const { speed, setSpeed } = useStore.getState();
    resume.current = speed;
    setSpeed(0);
    setInstalling(next);
  };
  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert os-update" role="alertdialog" aria-modal="true" aria-labelledby="os-title" aria-describedby="os-text">
        <span className="alert-icon"><Download /></span>
        <h2 id="os-title">Software Update</h2>
        <p id="os-text">Pear OS {next.version} {next.name} is available for your computer.</p>
        <div className="alert-actions">
          <button className="btn" onClick={() => setLater(next.id)}>Later</button>
          <button className="btn primary" autoFocus onClick={start}>Update</button>
        </div>
      </div>
    </div>,
    host,
  );
}

// Full-screen install while the clock is stopped, then a login that takes any password.
function Install({ release, host, onDone }: { release: OsRelease; host: Element; onDone: () => void }) {
  const act = useStore((s) => s.act);
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const done = progress >= 1;
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    ref.current?.focus();
    const begin = performance.now();
    const id = setInterval(() => setProgress(Math.min(1, (performance.now() - begin) / INSTALL_MS)), 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (done) act(updateOs); }, [done, act]);
  return createPortal(
    <div ref={ref} className="os-install" role="alertdialog" aria-label={`Installing Pear OS ${release.version}`} tabIndex={-1}>
      {done ? (
        <form className="os-login" onSubmit={(e) => { e.preventDefault(); onDone(); }}>
          <span className="os-avatar"><User /></span>
          <input type="password" aria-label="Password" placeholder="Password" autoFocus />
        </form>
      ) : (
        <>
          <strong>Installing Pear OS {release.version} {release.name}</strong>
          <div className="os-progress"><span style={{ width: `${progress * 100}%` }} /></div>
          <span>Please do not turn off your computer.</span>
        </>
      )}
    </div>,
    host,
  );
}
