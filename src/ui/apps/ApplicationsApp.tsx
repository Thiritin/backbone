import { BookOpen, CircleArrowDown, Disc3, FileText, LayoutGrid, Monitor, Usb } from "lucide-react";
import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { yearOf } from "../../sim/00-core/time";
import type { ServerOsId } from "../../sim/10-catalog/server-os";
import { addAppLink, setDocked } from "../../sim/90-actions/docs";
import { stickHome, writeStick } from "../../sim/90-actions/media";
import { menuOn, type MenuEntry } from "../desktop/ContextMenu";
import { useFocus, useStore } from "../store";
import { isoFile } from "./browser/sites/software/SoftwareSite";
import { APPS, appFor } from "./registry";

type Folder = "apps" | "desktop" | "downloads" | "usb";
const ISO = "application/x-backbone-iso";

export function appMenu(app: string) {
  const { game, act, openApp } = useStore.getState();
  const docked = !game.undocked.includes(app);
  return [
    { label: "Open", run: () => openApp(app) },
    null,
    { label: docked ? "Remove from Dock" : "Keep in Dock", run: () => act(setDocked, app, !docked) },
    { label: "Add to Desktop", run: () => act(addAppLink, app) },
  ];
}

// The app is still named Applications in saves; on screen it is Finder, with Applications as one of its folders.
export function ApplicationsApp() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [folder, setFolder] = useState<Folder>("apps");
  const [over, setOver] = useState(false);
  useFocus("Applications", (f) => setFolder(f.id as Folder));
  const home = stickHome(game), at = home ? folder : folder === "usb" ? "apps" : folder, year = yearOf(game.hour);
  const write = (id: ServerOsId) => act(writeStick, id);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData(ISO);
    if (id) write(id as ServerOsId);
  };
  const target = { onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes(ISO)) { e.preventDefault(); setOver(true); } }, onDragLeave: () => setOver(false), onDrop: drop };
  const side = (id: Folder, Icon: typeof Monitor, label: string, extra = {}) => (
    <button className={`side-item${at === id ? " active" : ""}${id === "usb" && over ? " drop" : ""}`} aria-pressed={at === id} onClick={() => setFolder(id)} {...extra}><Icon aria-hidden />{label}</button>
  );

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Folders">
        <div className="side-h">Favourites</div>
        {side("apps", LayoutGrid, "Applications")}
        {side("desktop", Monitor, "Desktop")}
        {side("downloads", CircleArrowDown, "Downloads")}
        {home && <>
          <div className="side-h">Locations</div>
          {side("usb", Usb, "USB stick", target)}
        </>}
      </nav>
      <div className="app-grid" {...(at === "usb" ? target : {})}>
        {at === "apps" && APPS.filter((a) => !a.hidden && game.installed.includes(a.name)).map((a) => {
          const shown = appFor(game, a.name);
          return (
            <Item key={a.name} label={shown.name} open={() => useStore.getState().openApp(a.name)} menu={() => appMenu(a.name)}>
              <span className="dock-tile" style={{ "--tile": shown.tile } as CSSProperties}><shown.icon /></span>
            </Item>
          );
        })}
        {at === "desktop" && game.docs.map((d) => {
          const app = d.kind === "app" && APPS.some((a) => a.name === d.title) ? appFor(game, d.title) : null;
          const Icon = app?.icon ?? (d.kind === "guide" ? BookOpen : FileText);
          const open = () => useStore.getState().openDoc(d.id);
          return (
            <Item key={d.id} label={app?.name ?? d.title} open={open} menu={() => [{ label: "Open", run: open }]}>
              {app ? <span className="dock-tile" style={{ "--tile": app.tile } as CSSProperties}><Icon /></span> : <span className={`di-page di-${d.kind}`}><Icon /></span>}
            </Item>
          );
        })}
        {at === "downloads" && game.media.images.map((id) => (
          <Item key={id} label={isoFile(id, year)} menu={() => [{ label: "Write to USB stick", disabled: !home, run: () => write(id) }]}
            drag={(e) => { e.dataTransfer.setData(ISO, id); e.dataTransfer.effectAllowed = "copy"; }}>
            <span className="di-page"><Disc3 /></span>
          </Item>
        ))}
        {at === "usb" && game.media.stick.os && (
          <Item label={isoFile(game.media.stick.os, year)}><span className="di-page"><Disc3 /></span></Item>
        )}
      </div>
    </div>
  );
}

function Item({ label, open, menu, drag, children }: { label: string; open?: () => void; menu?: () => MenuEntry[]; drag?: (e: DragEvent) => void; children: ReactNode }) {
  return (
    <button className="app-grid-item" draggable={!!drag} onDragStart={drag} onDoubleClick={open} onKeyDown={(e) => e.key === "Enter" && open?.()} onContextMenu={menu && menuOn(menu)}>
      {children}
      <span>{label}</span>
    </button>
  );
}
