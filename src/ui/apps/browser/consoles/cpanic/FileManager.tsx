import {
  ArrowUp, CheckSquare, ChevronDown, ChevronRight, Copy, FileArchive, FilePlus, FileText, Folder, FolderOpen, FolderPlus, Home, KeyRound,
  Move, Package, PackageOpen, Pencil, Plus, RefreshCw, Square, Trash2, Upload, type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { useT } from "../look";
import { LOCALE } from "../../../../../i18n/lang";
import { dateOf } from "../../../../../sim/00-core/time";
import { ARCHIVE_EXT } from "../../../../../sim/10-catalog/archives";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { modeOf, webspaceOf, type Webspace } from "../../../../../sim/60-infra/webspace";
import { downloadedFiles } from "../../../../../sim/90-actions/media";
import { createFolder, deleteFile, renameFile } from "../../../../../sim/90-actions/webspace";
import { chmodFile, compressFiles, copyFiles, createFile, extractFile, moveFiles, type CompressKind } from "../../../../../sim/90-actions/webspace-files";
import { startUpload, useUploadsInto } from "../../../../downloads";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { useStore } from "../../../../store";
import { eraAt, looks } from "../PanelBase";
import "./filemanager.css";

// The WHM generations of CPanic.tsx; X3 has its own toolbar labels, Paper Lantern and Jupiter share the newer ones.
const LOOKS = looks({ x3: 2005, paperLamp: 2014, jupitar: 2021 });
type Tool = "newFile" | "newFolder" | "copy" | "move" | "upload" | "delete" | "rename" | "chmod" | "extract" | "compress";
type Dialog = Exclude<Tool, "upload">;
const TOOLS: [Tool, LucideIcon, x3: string, later: string][] = [
  ["newFile", FilePlus, "filemanager.newFile", "filemanager.addFile"], ["newFolder", FolderPlus, "filemanager.newFolder", "filemanager.addFolder"],
  ["copy", Copy, "filemanager.copy", "filemanager.copy"], ["move", Move, "filemanager.moveFile", "filemanager.move"],
  ["upload", Upload, "filemanager.upload", "filemanager.upload"], ["delete", Trash2, "filemanager.delete", "filemanager.delete"],
  ["rename", Pencil, "filemanager.rename", "filemanager.rename"], ["chmod", KeyRound, "filemanager.changePermissions", "filemanager.permissions"],
  ["extract", PackageOpen, "filemanager.extract", "filemanager.extract"], ["compress", Package, "filemanager.compress", "filemanager.compress"],
];
const KINDS: CompressKind[] = ["zip", "tar", "gz", "bz2"];

const parentOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf("/")));
const base = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const shown = (p: string) => `/${p}`;
// Accepts "/public_html/", "public_html" or the full path under the home folder.
const parse = (ws: Webspace, text: string) => text.trim().replace(new RegExp(`^${ws.home}(?=/|$)`), "").replace(/^\/+|\/+$/g, "");
const kids = (ws: Webspace, dir: string) => Object.keys(ws.files).filter((p) => parentOf(p) === dir)
  .sort((a, b) => Number(!!ws.files[b].dir) - Number(!!ws.files[a].dir) || a.localeCompare(b));
// cPanel's mime type column.
const typeOf = (p: string, dir?: boolean) => dir ? "httpd/unix-directory" : ARCHIVE_EXT.test(p) ? "package/x-generic" : p.endsWith(".php") ? "application/x-httpd-php"
  : /\.html?$/.test(p) ? "text/html" : p.endsWith(".iso") ? "application/x-iso9660-image" : "text/x-generic";
function size(mb: number): string {
  const bytes = mb * 1048576, n = (x: number) => x.toLocaleString(LOCALE, { maximumFractionDigits: 2 });
  return bytes < 1024 ? t("filemanager.bytes", { n: Math.round(bytes) }) : bytes < 1048576 ? `${n(bytes / 1024)} KB` : mb < 1024 ? `${n(mb)} MB` : `${n(mb / 1024)} GB`;
}
const when = (hour: number) => dateOf(hour).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

// docs/design/web-hosting.md 4.1: cPanel's File Manager over the web space, tree on the left, the folder's listing on the right.
export function FileManager({ game, c, workloadId }: { game: GameState; c: Cluster; workloadId: string }) {
  const t = useT();
  const ws = webspaceOf(game, workloadId), x3 = eraAt(LOOKS, { game, c }) === "x3";
  const [at, setAt] = useState(ws?.webroot ?? ""), [sel, setSel] = useState<string[]>([]), [dialog, setDialog] = useState<Dialog | null>(null);
  const [uploading, setUploading] = useState(false), [typed, setTyped] = useState<string | null>(null), [opened, setOpened] = useState<string[]>(ws ? [ws.webroot] : []);
  if (!ws) return null;
  const dir = at === "" || ws.files[at]?.dir ? at : "", list = kids(ws, dir), picked = sel.filter((p) => ws.files[p]);
  const go = (p: string) => { setAt(p); setSel([]); setTyped(null); setOpened((o) => [...new Set([...o, ...p.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"))])]); };
  const one = picked.length === 1 ? picked[0] : null;
  const needs: Record<Tool, boolean> = {
    newFile: true, newFolder: true, upload: true, copy: picked.length > 0, move: picked.length > 0, delete: picked.length > 0, compress: picked.length > 0,
    rename: !!one, chmod: !!one, extract: !!one && !ws.files[one].dir && ARCHIVE_EXT.test(one),
  };
  const click = (p: string, multi: boolean) => setSel(multi ? (sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p]) : [p]);
  if (uploading) return <UploadPage game={game} ws={ws} dir={dir} back={() => setUploading(false)} />;
  return (
    <div className="fm" data-x3={x3 || undefined}>
      <h1 className="fm-title">{t("filemanager.title")}</h1>
      <div className="fm-tools" role="toolbar">
        {TOOLS.map(([id, Icon, a, b]) => (
          <button key={id} type="button" disabled={!needs[id]} onClick={() => (id === "upload" ? setUploading(true) : setDialog(id))}>
            {!x3 && (id === "newFile" || id === "newFolder") ? <Plus size={14} aria-hidden /> : <Icon size={x3 ? 22 : 14} aria-hidden />}<span>{t(x3 ? a : b)}</span>
          </button>
        ))}
      </div>
      <div className="fm-body">
        <aside className="fm-tree">
          <form className="fm-path" onSubmit={(e) => { e.preventDefault(); const p = parse(ws, typed ?? ""); if (p === "" || ws.files[p]?.dir) go(p); }}>
            <input aria-label={t("filemanager.name")} value={typed ?? shown(dir)} onChange={(e) => setTyped(e.target.value)} />
            <button type="submit" className="cx-btn">{t("filemanager.go")}</button>
          </form>
          <button type="button" className="fm-collapse" onClick={() => setOpened([])}>{t("filemanager.collapseAll")}</button>
          <ul>
            <li>
              <button type="button" className="fm-node" aria-current={dir === "" || undefined} onClick={() => go("")}><Home size={13} aria-hidden />{ws.home}</button>
              <Tree ws={ws} dir="" at={dir} opened={opened} go={go} toggle={(p) => setOpened(opened.includes(p) ? opened.filter((x) => x !== p) : [...opened, p])} />
            </li>
          </ul>
        </aside>
        <section className="fm-main">
          <div className="fm-nav">
            <button type="button" onClick={() => go("")}><Home size={13} aria-hidden />{t("filemanager.home")}</button>
            <button type="button" disabled={dir === ""} onClick={() => go(parentOf(dir))}><ArrowUp size={13} aria-hidden />{t("filemanager.up")}</button>
            <button type="button" onClick={() => setSel([])}><RefreshCw size={13} aria-hidden />{t("filemanager.reload")}</button>
            <button type="button" onClick={() => setSel(list)}><CheckSquare size={13} aria-hidden />{t("filemanager.selectAll")}</button>
            <button type="button" onClick={() => setSel([])}><Square size={13} aria-hidden />{t("filemanager.unselectAll")}</button>
          </div>
          <table className="fm-list">
            <thead><tr><th>{t("filemanager.name")}</th><th>{t("filemanager.size")}</th><th>{t("filemanager.modified")}</th><th>{t("filemanager.type")}</th><th>{t(x3 ? "filemanager.perms" : "filemanager.permissions")}</th></tr></thead>
            <tbody>
              {list.map((p) => {
                const f = ws.files[p], Icon = f.dir ? Folder : ARCHIVE_EXT.test(p) ? FileArchive : FileText;
                return (
                  <tr key={p} aria-selected={picked.includes(p)} onClick={(e) => click(p, e.metaKey || e.ctrlKey)} onDoubleClick={() => f.dir && go(p)}>
                    <td><Icon size={14} aria-hidden /> {base(p)}</td>
                    <td className="num">{f.dir ? "4 KB" : size(f.mb)}</td>
                    <td className="num">{when(f.at)}</td>
                    <td>{typeOf(p, f.dir)}</td>
                    <td className="num">{modeOf(p, f)}</td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={5} className="cx-empty">{t("filemanager.empty")}</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
      {dialog && <Dialogs kind={dialog} ws={ws} dir={dir} picked={picked} close={() => { setDialog(null); setSel([]); }} />}
    </div>
  );
}

function Tree({ ws, dir, at, opened, go, toggle }: { ws: Webspace; dir: string; at: string; opened: string[]; go: (p: string) => void; toggle: (p: string) => void }) {
  const dirs = kids(ws, dir).filter((p) => ws.files[p].dir);
  if (!dirs.length) return null;
  return (
    <ul>
      {dirs.map((p) => {
        const open = opened.includes(p), more = kids(ws, p).some((k) => ws.files[k].dir), Icon = open ? FolderOpen : Folder;
        return (
          <li key={p}>
            <span className="fm-row">
              <button type="button" className="fm-twist" disabled={!more} aria-label={base(p)} aria-expanded={more ? open : undefined} onClick={() => toggle(p)}>
                {more && (open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />)}
              </button>
              <button type="button" className="fm-node" aria-current={p === at || undefined} onClick={() => go(p)}><Icon size={13} aria-hidden />{base(p)}</button>
            </span>
            {open && <Tree ws={ws} dir={p} at={at} opened={opened} go={go} toggle={toggle} />}
          </li>
        );
      })}
    </ul>
  );
}

// The popup each toolbar action opens, with the fields and button labels of cPanel's own.
function Dialogs({ kind, ws, dir, picked, close }: { kind: Dialog; ws: Webspace; dir: string; picked: string[]; close: () => void }) {
  const attempt = useStore((x) => x.attempt), [failed, setFailed] = useState<ActionResult | null>(null), id = ws.workloadId, first = picked[0] ?? "";
  const act: typeof attempt = (fn, ...args) => { const r = attempt(fn, ...args); setFailed(r.ok ? null : r); return r; };
  const [name, setName] = useState(kind === "rename" ? base(first) : kind === "compress" ? (picked.length === 1 ? base(first) : "archive") : "");
  const [path, setPath] = useState(shown(kind === "extract" ? parentOf(first) : dir));
  const [mode, setMode] = useState(first ? modeOf(first, ws.files[first]).slice(1) : "644"), [type, setType] = useState<CompressKind>("zip");
  const run = (r: { ok: boolean }) => r.ok && close();
  const target = parse(ws, path);
  const forms: Record<Dialog, [ReactNode, string, () => void]> = {
    newFile: [<><Field label={t("filemanager.newFileName")} value={name} set={setName} /><Field label={t("filemanager.fileIn")} value={path} set={setPath} /></>,
      "filemanager.createFile", () => run(act(createFile, id, target, name))],
    newFolder: [<><Field label={t("filemanager.newFolderName")} value={name} set={setName} /><Field label={t("filemanager.folderIn")} value={path} set={setPath} /></>,
      "filemanager.createFolder", () => run(act(createFolder, id, target, name))],
    rename: [<Field label={t("filemanager.renameTo")} value={name} set={setName} />, "filemanager.renameFile", () => run(act(renameFile, id, first, name))],
    move: [<><Names picked={picked} /><Field label={t("filemanager.moveTo")} value={path} set={setPath} /></>, "filemanager.moveFiles", () => run(act(moveFiles, id, picked, target))],
    copy: [<><Names picked={picked} /><Field label={t("filemanager.copyTo")} value={path} set={setPath} /></>, "filemanager.copyFiles", () => run(act(copyFiles, id, picked, target))],
    delete: [<><p>{t("filemanager.deleteAsk")}</p><Names picked={picked} /></>, "filemanager.confirm", () => run(picked.reduce<ActionResult>((r, p) => (r.ok ? act(deleteFile, id, p) : r), { ok: true }))],
    extract: [<><Names picked={picked} /><Field label={t("filemanager.extractTo")} value={path} set={setPath} /></>, "filemanager.extractFiles", () => run(act(extractFile, id, first, target))],
    compress: [<>
      <fieldset className="fm-kinds"><legend>{t("filemanager.compressType")}</legend>
        {KINDS.map((k) => <label key={k}><input type="radio" name="fm-kind" checked={type === k} onChange={() => setType(k)} />{t(`filemanager.${k}`)}</label>)}
      </fieldset>
      <Names picked={picked} /><Field label={t("filemanager.archiveName")} value={name} set={setName} />
    </>, "filemanager.compressFiles", () => run(act(compressFiles, id, picked, name, type))],
    chmod: [<Perms mode={mode} set={setMode} />, "filemanager.changePermissions", () => run(act(chmodFile, id, first, mode))],
  };
  const [body, button, submit] = forms[kind];
  return (
    <div className="fm-shade">
      <form className="fm-dialog" role="dialog" aria-label={t(TOOLS.find(([x]) => x === kind)![2])} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h2>{t(TOOLS.find(([x]) => x === kind)![2])}</h2>
        {body}
        {failed && !failed.ok && <p className="cx-banner bad" role="alert">{t(failed.error, failed.params)}</p>}
        <div className="fm-actions">
          <button type="submit" className="cx-btn primary">{t(button)}</button>
          <button type="button" className="cx-btn" onClick={close}>{t("filemanager.cancel")}</button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, value, set }: { label: string; value: string; set: (v: string) => void }) => (
  <label className="fm-field"><span>{label}</span><input value={value} onChange={(e) => set(e.target.value)} autoFocus /></label>
);
const Names = ({ picked }: { picked: string[] }) => <ul className="fm-names">{picked.map((p) => <li key={p}>{shown(p)}</li>)}</ul>;

// The read, write and execute grid for user, group and world, kept in step with the octal mode.
function Perms({ mode, set }: { mode: string; set: (m: string) => void }) {
  const digits = mode.padStart(3, "0").slice(-3).split("").map((d) => Number(d) || 0);
  const flip = (who: number, bit: number) => set(digits.map((d, i) => (i === who ? d ^ bit : d)).join(""));
  return (
    <table className="fm-perms">
      <thead><tr><th>{t("filemanager.mode")}</th><th>{t("filemanager.user")}</th><th>{t("filemanager.group")}</th><th>{t("filemanager.world")}</th></tr></thead>
      <tbody>
        {([["filemanager.read", 4], ["filemanager.write", 2], ["filemanager.execute", 1]] as const).map(([key, bit]) => (
          <tr key={key}><th>{t(key)}</th>{digits.map((d, who) => <td key={who}><input type="checkbox" checked={(d & bit) > 0} onChange={() => flip(who, bit)} /></td>)}</tr>
        ))}
        <tr><th /><td colSpan={3}><input className="num" aria-label={t("filemanager.permissions")} value={mode} maxLength={4} onChange={(e) => set(e.target.value)} /></td></tr>
      </tbody>
    </table>
  );
}

// cPanel's upload page: the files come from the player's Downloads and move at the line's upload speed.
function UploadPage({ game, ws, dir, back }: { game: GameState; ws: Webspace; dir: string; back: () => void }) {
  const [overwrite, setOverwrite] = useState(false), [failed, setFailed] = useState<ActionResult | null>(null), [sent, setSent] = useState<string[]>([]);
  const running = new Map(useUploadsInto(ws.workloadId)), files = downloadedFiles(game);
  const send = (file: string) => {
    const r = startUpload(ws.workloadId, dir, file, overwrite);
    setFailed(r.ok ? null : r);
    if (r.ok && !sent.includes(r.id!)) setSent([...sent, r.id!]);
  };
  return (
    <div className="fm fm-upload">
      <h1 className="fm-title">{t("filemanager.upload")}</h1>
      <p>{t("filemanager.uploadTo", { path: `${ws.home}${dir ? `/${dir}` : ""}` })}</p>
      <label className="fm-check"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />{t("filemanager.overwrite")}</label>
      <table className="fm-list">
        <thead><tr><th>{t("filemanager.downloads")}</th><th>{t("filemanager.size")}</th><th /></tr></thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id}><td><FileArchive size={14} aria-hidden /> {f.name}</td><td className="num">{size(f.mb)}</td>
              <td><button type="button" className="cx-btn" onClick={() => send(f.id)}><Upload size={13} aria-hidden />{t("filemanager.upload")}</button></td></tr>
          ))}
          {!files.length && <tr><td colSpan={3} className="cx-empty">{t("filemanager.noDownloads")}</td></tr>}
        </tbody>
      </table>
      {failed && !failed.ok && <p className="cx-banner bad" role="alert">{t(failed.error, failed.params)}</p>}
      {sent.map((p) => {
        const share = running.get(p), finished = share === undefined && !!ws.files[p];
        return (
          <div key={p} className="fm-progress">
            <span>{base(p)}</span>
            <span className="cx-bar"><i style={{ width: `${Math.round((finished ? 1 : share ?? 0) * 100)}%` }} /></span>
            <span className="num">{finished ? t("filemanager.complete") : `${Math.round((share ?? 0) * 100)}%`}</span>
          </div>
        );
      })}
      <button type="button" className="fm-back" onClick={back}>{t("filemanager.back", { path: shown(dir) })}</button>
    </div>
  );
}
