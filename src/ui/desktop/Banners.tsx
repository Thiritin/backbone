import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { appByName } from "../apps/registry";
import { formatClock } from "../../sim/00-core/time";
import { useStore, type Banner } from "../store";

function Card({ b, time }: { b: Banner; time: string }) {
  const { openApp, dismiss } = useStore();
  const app = appByName(b.app);
  const open = () => { openApp(b.app); dismiss(b.id); };
  return (
    <div className="banner" role="button" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
      <span className="b-icon" style={{ "--tile": app.tile } as CSSProperties}><app.icon /></span>
      <span><span className="b-app">{b.app}</span><span className="b-title">{b.title}</span><span className="b-text">{b.text}</span></span>
      <span className="b-time">{time}</span>
      <button className="b-close" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); dismiss(b.id); }}><X /></button>
    </div>
  );
}

export function Banners() {
  const banners = useStore((s) => s.banners);
  return <div className="banners" aria-live="polite">{banners.map((b) => <Card key={b.id} b={b} time="now" />)}</div>;
}

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const history = useStore((s) => s.history);
  return (
    <aside className="notif-center" aria-label="Notifications" onPointerDown={(e) => e.stopPropagation()}>
      <div className="notif-head"><h2>Notifications</h2><button className="btn ghost" onClick={onClose}>Close</button></div>
      {history.length === 0 ? <p className="notif-empty">You have no notifications.</p>
        : history.map((b) => <Card key={b.id} b={b} time={formatClock(b.hour).slice(4, -8)} />)}
    </aside>
  );
}
