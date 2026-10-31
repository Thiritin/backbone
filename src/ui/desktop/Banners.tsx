import { t } from "../../i18n/en";
import { Settings, X } from "lucide-react";
import type { CSSProperties } from "react";
import { appFor } from "../apps/registry";
import { formatClock } from "../../sim/00-core/time";
import { useStore, type Banner } from "../store";

function Card({ b, time, dismiss, gear }: { b: Banner; time: string; dismiss: (id: number) => void; gear?: () => void }) {
  const openApp = useStore((s) => s.openApp);
  const app = appFor(useStore((s) => s.game), b.app);
  const open = () => { openApp(b.app, b.focus); dismiss(b.id); };
  return (
    <div className="banner" role="button" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
      <span className="b-icon" style={{ "--tile": app.tile } as CSSProperties}><app.icon /></span>
      <span><span className="b-app">{app.name}</span><span className="b-title">{b.title}</span><span className="b-text">{b.text}</span></span>
      <span className="b-time">{time}</span>
      {gear && <button className="b-close b-set" aria-label={t("desktop.notif.appSettings", { name: app.name })} onClick={(e) => { e.stopPropagation(); gear(); }}><Settings /></button>}
      <button className="b-close" aria-label={t("desktop.notif.dismiss")} onClick={(e) => { e.stopPropagation(); dismiss(b.id); }}><X /></button>
    </div>
  );
}

export function Banners() {
  const { banners, dismiss } = useStore();
  return <div className="banners" aria-live="polite">{banners.map((b) => <Card key={b.id} b={b} time={t("desktop.notif.now")} dismiss={dismiss} />)}</div>;
}

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { history, forget, openApp } = useStore();
  const settings = (app = "") => openApp("Settings", { kind: "notifications", id: app });
  return (
    <aside className="notif-center" aria-label={t("desktop.notif.title")} onPointerDown={(e) => e.stopPropagation()}>
      <div className="notif-head"><h2>{t("desktop.notif.title")}</h2>{history.length > 0 && <button className="btn ghost" onClick={() => forget(null)}>{t("desktop.notif.clear")}</button>}<button className="btn ghost" onClick={() => openApp("News")}>{t("desktop.notif.news")}</button><button className="btn ghost b-gear" aria-label={t("desktop.notif.settings")} onClick={() => settings()}><Settings /></button><button className="btn ghost" onClick={onClose}>{t("desktop.close")}</button></div>
      {history.length === 0 ? <p className="notif-empty">{t("desktop.notif.empty")}</p>
        : history.map((b) => <Card key={b.id} b={b} time={formatClock(b.hour).slice(4, -8)} dismiss={forget} gear={() => settings(b.app)} />)}
    </aside>
  );
}
