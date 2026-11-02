import { deskUrl } from "./browser/sites/desk/DeskSite";
import { CircleArrowDown, CircleX, Disc3, LayoutGrid, Monitor, Trash2, Usb } from "lucide-react";
import { FILE_ICON, fileIcon } from "../art/era-icon";
import { yearOf } from "../../sim/00-core/time";
import { installerFile, programById, PROGRAMS } from "../../sim/10-catalog/programs";
import { installProgram, removable, uninstallApp } from "../../sim/90-actions/programs";
import { booksVendor } from "../../sim/10-catalog/bookkeeping";
import { installBooks } from "../../sim/90-actions/bookkeeping";
import { ask } from "../desktop/Confirm";
import { useEffect, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { imageParts, type OsImage } from "../../sim/10-catalog/server-os";
import { addAppLink, setDocked } from "../../sim/90-actions/docs";
import { IMAGE_MB, stickHome, writeStick } from "../../sim/90-actions/media";
import { createPortal } from "react-dom";
import { menuOn, type MenuEntry } from "../desktop/ContextMenu";
import { uiSound, useFocus, useStore } from "../store";
import { isoFile } from "./browser/sites/software/SoftwareSite";
import { t } from "../../i18n/en";
import { APPS, appFor, appTitle } from "./registry";

type Folder = "apps" | "desktop" | "downloads" | "usb" | "trash";
const ISO = "application/x-backbone-iso";
const INSTALLER = "application/x-backbone-installer";
// Set only for an app that can go to the Trash, so the Trash turns every other app away.
export const APP = "application/x-backbone-app";
// The stick's write speed in MB/s.
const SPEED = 75;

export function appMenu(app: string) {
  const { game, act, openApp } = useStore.getState();
  const docked = !game.undocked.includes(app);
  return [
    { label: t("apps.finder.open"), run: () => openApp(app) },
    app === "Browser" && { label: t("apps.finder.newWindow"), run: () => openApp(app, undefined, true) },
    app === "Support" && !!deskUrl(game) && { label: t("desk.launcher.mailbox"), run: () => openApp(app, { kind: "mailbox", id: "" }) },
    null,
    { label: docked ? t("apps.finder.removeFromDock") : t("apps.finder.keepInDock"), run: () => act(setDocked, app, !docked) },
    { label: t("apps.finder.addToDesktop"), run: () => act(addAppLink, app) },
  ];
}

export const dragApp = (app: string) => removable(app) ? (e: DragEvent) => { e.dataTransfer.setData(APP, app); e.dataTransfer.effectAllowed = "move"; } : undefined;

export function dropTarget(type: string, run: (id: string) => void, over: (on: boolean) => void) {
  return {
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes(type)) { e.preventDefault(); over(true); } },
    onDragLeave: () => over(false),
    onDrop: (e: DragEvent) => { e.preventDefault(); over(false); const id = e.dataTransfer.getData(type); if (id) run(id); },
  };
}

export function trashApp(app: string) {
  const { game, act } = useStore.getState();
  const go = () => { if (act(uninstallApp, app).ok) useStore.setState(({ windows }) => ({ windows: windows.filter((w) => w.app !== app) })); };
  if (app !== "Books") { uiSound("trash"); return go(); }
  const name = appTitle(appFor(game, app));
  ask({ title: t("apps.finder.trashTitle", { name }), text: t("apps.finder.trashText", { name }), action: t("apps.finder.moveToTrash"), run: go });
}

// A desktop bookkeeping program replaces the running one once the player confirms.
function install(id: string) {
  const { game, act } = useStore.getState();
  if (programById(id)) return void act(installProgram, id);
  const v = booksVendor(id), now = booksVendor(game.books.vendor);
  if (!v) return;
  if (!now || now.id === v.id) return void act(installBooks, id);
  const p = { old: now.program, name: v.program };
  ask({ title: t("apps.finder.replaceTitle", p), text: t("apps.finder.replaceText", p), action: t("apps.finder.replace"), run: () => act(installBooks, id) });
}

// The app is still named Applications in saves; on screen it is Finder, with Applications as one of its folders.
export function ApplicationsApp() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [folder, setFolder] = useState<Folder>("apps");
  const [over, setOver] = useState<Folder | null>(null);
  const [copy, setCopy] = useState<OsImage | null>(null);
  useFocus("Applications", (f) => setFolder(f.id as Folder));
  const books = game.books.download;
  const home = stickHome(game), at = home ? folder : folder === "usb" ? "apps" : folder;
  const write = (id: OsImage) => { if (!copy) setCopy(id); };
  const target = (id: Folder) => {
    const over = (on: boolean) => setOver(on ? id : null);
    if (id === "usb") return dropTarget(ISO, (iso) => write(iso as OsImage), over);
    if (id === "apps") return dropTarget(INSTALLER, install, over);
    if (id === "trash") return dropTarget(APP, trashApp, over);
    return {};
  };
  const side = (id: Folder, Icon: typeof Monitor, label: string) => (
    <button className={`side-item${at === id ? " active" : ""}${over === id ? " drop" : ""}`} {...target(id)} aria-pressed={at === id} onClick={() => setFolder(id)}><Icon aria-hidden />{label}</button>
  );

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label={t("apps.finder.folders")}>
        <div className="side-h">{t("apps.finder.favourites")}</div>
        {side("apps", LayoutGrid, t("apps.finder.applications"))}
        {side("desktop", Monitor, t("apps.finder.desktop"))}
        {side("downloads", CircleArrowDown, t("apps.finder.downloads"))}
        {side("trash", Trash2, t("apps.finder.trash"))}
        {home && <>
          <div className="side-h">{t("apps.finder.locations")}</div>
          {side("usb", Usb, t("apps.finder.usb"))}
        </>}
      </nav>
      {copy && <Copying key={copy} file={isoFile(copy)} size={IMAGE_MB[imageParts(copy).id]} onStop={() => setCopy(null)} onDone={() => { setCopy(null); act(writeStick, copy); }} />}
      <div className="app-grid" {...target(at)}>
        {at === "apps" && APPS.filter((a) => !a.hidden && game.installed.includes(a.name)).map((a) => {
          const shown = appFor(game, a.name);
          return (
            <Item key={a.name} label={appTitle(shown)} open={() => useStore.getState().openApp(a.name)} drag={dragApp(a.name)}
              menu={() => removable(a.name) ? [...appMenu(a.name), null, { label: t("apps.finder.moveToTrash"), run: () => trashApp(a.name) }] : appMenu(a.name)}>
              <span className="dock-tile" style={{ "--tile": shown.tile } as CSSProperties}><shown.icon /></span>
            </Item>
          );
        })}
        {at === "desktop" && game.docs.map((d) => {
          const app = d.kind === "app" && APPS.some((a) => a.name === d.title) ? appFor(game, d.title) : null;
          const Icon = app?.icon ?? FILE_ICON[d.kind] ?? FILE_ICON.note;
          const open = () => useStore.getState().openDoc(d.id);
          return (
            <Item key={d.id} label={app ? appTitle(app) : d.title} open={open} menu={() => [{ label: t("apps.finder.open"), run: open }]}>
              {app ? <span className="dock-tile" style={{ "--tile": app.tile } as CSSProperties}><Icon /></span> : <span className={`di-page di-${d.kind}`}><Icon /></span>}
            </Item>
          );
        })}
        {at === "downloads" && game.media.images.map((id) => (
          <Item key={id} label={isoFile(id)} menu={() => [{ label: t("apps.finder.writeToUsb"), disabled: !home, run: () => write(id) }]}
            drag={(e) => { e.dataTransfer.setData(ISO, id); e.dataTransfer.effectAllowed = "copy"; }}>
            <span className="di-page"><FILE_ICON.iso /></span>
          </Item>
        ))}
        {at === "downloads" && game.media.files.map((name) => (
          <Item key={name} label={name}><span className="di-page">{fileIcon(name)}</span></Item>
        ))}
        {at === "downloads" && [
          ...PROGRAMS.filter((p) => game.installers[p.id] && game.hour >= game.installers[p.id].readyAt).map((p) => ({ id: p.id, file: installerFile(p, yearOf(game.hour)) })),
          ...(books && game.hour >= books.readyAt ? [{ id: books.vendor, file: `${booksVendor(books.vendor)?.program}.dmg` }] : []),
        ].map(({ id, file }) => (
          <Item key={id} label={file} menu={() => [{ label: t("apps.finder.moveToApplications"), run: () => install(id) }]}
            drag={(e) => { e.dataTransfer.setData(INSTALLER, id); e.dataTransfer.effectAllowed = "copy"; }}>
            <span className="di-page"><FILE_ICON.installer /></span>
          </Item>
        ))}
        {at === "usb" && game.media.stick.os && (
          <Item label={isoFile(game.media.stick.os)}><span className="di-page"><FILE_ICON.iso /></span></Item>
        )}
      </div>
    </div>
  );
}

// The Copy window of the classic Finder; closing Finder stops the copy.
function Copying({ file, size, onStop, onDone }: { file: string; size: number; onStop: () => void; onDone: () => void }) {
  const [mb, setMb] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const t = setInterval(() => setMb(Math.min(size, ((performance.now() - start) / 1000) * SPEED)), 100);
    return () => clearInterval(t);
  }, [size]);
  useEffect(() => { if (mb >= size) onDone(); }, [mb >= size]);
  const left = Math.ceil((size - mb) / SPEED);
  return createPortal(
    <section className="window front copy-win" aria-label={t("apps.finder.copy")}>
      <div className="titlebar"><h1>{t("apps.finder.copy")}</h1></div>
      <div className="copy-body">
        <Disc3 aria-hidden />
        <div>
          <p>{t("apps.finder.copying", { file, target: t("apps.finder.usb") })}</p>
          <progress max={size} value={mb} />
          <p className="copy-sub">{t("apps.finder.progress", { mb: Math.floor(mb), size, left })}</p>
        </div>
        <button className="copy-stop" aria-label={t("apps.finder.stop")} onClick={onStop}><CircleX aria-hidden /></button>
      </div>
    </section>,
    document.querySelector(".desktop")!,
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
