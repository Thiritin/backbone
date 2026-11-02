import { File, Folder } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { dateOf, MS_PER_HOUR, nowHours, yearOf } from "../../../sim/00-core/time";
import { FTP_PORT, ftpLogin, SFTP_PORT, SFTP_YEAR, type FtpLogin } from "../../../sim/60-infra/ftp";
import { webspaceOf } from "../../../sim/60-infra/webspace";
import { downloadedFiles, transferHours, uploadMbps, type DownloadedFile } from "../../../sim/90-actions/media";
import { ftpUpload } from "../../../sim/90-actions/webspace-mail";
import { useStore } from "../../store";
import "./filegorilla.css";

// docs/design/web-hosting.md 4.4: FileZilla of the era with Quickconnect, the message log, both panes and the queue.
type Kind = "status" | "command" | "response" | "error";
interface Line { kind: Kind; text: string }
interface Session { workloadId: string; user: string; root: string; host: string }
interface Transfer { id: number; file: string; name: string; mb: number; dir: string; start: number; hours: number; error?: string }

const LOCAL_DIR = "/Users/admin/Downloads/";
const st = (text: string): Line => ({ kind: "status", text }), cmd = (text: string): Line => ({ kind: "command", text });
const res = (text: string): Line => ({ kind: "response", text }), err = (text: string): Line => ({ kind: "error", text });
const when = (hour: number) => dateOf(hour).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short" });
const size = (mb: number) => Math.round(mb * 1024 * 1024).toLocaleString(LOCALE);
const typeOf = (name: string) => (name.includes(".") ? t("fg.typeFile", { ext: name.split(".").pop()!.toUpperCase() }) : t("fg.file"));

// What the FTP daemons of the panels answer, as Pure-FTPd, ProFTPD and vsftpd do.
function replies(daemon: string, user: string, ip: string, hour: number): { hello: string[]; pass: string; ok: string; bad: string } {
  if (daemon === "pureeFtpd") return {
    hello: ["220---------- Welcome to Purée-FTPd [privsep] [TLS] ----------", "220-You are user number 1 of 50 allowed.",
      `220-Local time is now ${dateOf(hour).toTimeString().slice(0, 5)}. Server port: 21.`, "220 You will be disconnected after 15 minutes of inactivity."],
    pass: `331 User ${user} OK. Password required`, ok: "230 OK. Current restricted directory is /", bad: "530 Login authentication failed",
  };
  if (daemon === "vsftpeed") return { hello: ["220 (vsFTPeed 2.0.5)"], pass: "331 Please specify the password.", ok: "230 Login successful.", bad: "530 Login incorrect." };
  return { hello: [`220 ProFTPeed 1.3.1 Server (ProFTPeed Default Installation) [${ip}]`], pass: `331 Password required for ${user}`, ok: `230 User ${user} logged in`, bad: "530 Login incorrect." };
}

// The message log of one Quickconnect.
function connectLog(r: FtpLogin, host: string, user: string, port: number, sftp: boolean, hour: number): Line[] {
  const fail = [err(t("fg.log.critical"))];
  if (sftp) {
    const head = [st(t("fg.log.connecting", { addr: `${host}...` })), res("fzSftp started"), cmd(`open "${user}@${host}" ${port}`)];
    if (!r.ok && r.error === "resolve") return [...head, err(t("fg.log.noHost")), ...fail];
    if (!r.ok && r.error === "timeout") return [...head, err(t("fg.log.timeout")), ...fail];
    if (!r.ok) return [...head, cmd("Pass: ********"), err(t("fg.log.authFailed")), ...fail];
    return [...head, cmd("Pass: ********"), st(t("fg.log.connectedTo", { host })), st(t("fg.log.listing")), cmd("pwd"), res('Current directory is: "/"'), cmd("ls"), st(t("fg.log.listed", { path: "/" }))];
  }
  const head = [st(t("fg.log.resolving", { host }))];
  if (!r.ok && r.error === "resolve") return [...head, err(t("fg.log.noHost")), err(t("fg.log.noConnect"))];
  head.push(st(t("fg.log.connecting", { addr: `${r.ip}:${port}...` })));
  if (!r.ok && r.error === "timeout") return [...head, err(t("fg.log.timeout")), err(t("fg.log.noConnect"))];
  const say = replies(r.daemon!, user, r.ip!, hour);
  const login = [...head, st(t("fg.log.established")), ...say.hello.map(res), cmd(`USER ${user}`), res(say.pass), cmd("PASS ********")];
  if (!r.ok) return [...login, res(say.bad), ...fail];
  return [...login, res(say.ok), st(t("fg.log.connected")), st(t("fg.log.listing")), cmd("PWD"), res('257 "/" is your current location'), st(t("fg.log.listed", { path: "/" }))];
}


export function FileGorillaApp() {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt);
  const year = yearOf(game.hour), old = year < 2007, sftpEra = year >= SFTP_YEAR;
  const [host, setHost] = useState(""), [user, setUser] = useState(""), [pass, setPass] = useState(""), [port, setPort] = useState(""), [sftp, setSftp] = useState(false);
  const [log, setLog] = useState<Line[]>([]), [session, setSession] = useState<Session | null>(null), [cwd, setCwd] = useState("");
  const [picked, setPicked] = useState<string | null>(null), [queue, setQueue] = useState<Transfer[]>([]), [done, setDone] = useState<Transfer[]>([]), [tab, setTab] = useState<"queued" | "failed" | "done">("queued");
  const logEnd = useRef<HTMLDivElement>(null), nextId = useRef(1);
  const ws = session && webspaceOf(game, session.workloadId);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: "end" }); }, [log]);

  const connect = () => {
    const p = Number(port) || (sftp ? SFTP_PORT : FTP_PORT), r = ftpLogin(game, host, user, pass, p, sftp && sftpEra);
    setLog((l) => [...l, ...connectLog(r, host.trim(), user.trim(), p, sftp && sftpEra, game.hour)]);
    setSession(r.ok ? { workloadId: r.workloadId, user: user.trim(), root: r.folder, host: host.trim() } : null);
    setCwd(r.ok ? r.folder : "");
  };
  const disconnect = () => { setSession(null); setQueue([]); setLog((l) => [...l, st(t("fg.log.disconnected"))]); };

  // Transfers run in game time at the line's upload speed; closing the program drops the ones still running.
  useEffect(() => {
    if (!queue.length || !session) return;
    const id = setInterval(() => {
      const now = nowHours(useStore.getState().game);
      for (const x of queue.filter((q) => now - q.start >= q.hours)) {
        const r = attempt(ftpUpload, session.workloadId, session.user, x.dir, x.file);
        const secs = Math.max(1, Math.round((x.hours * MS_PER_HOUR) / 1000));
        setLog((l) => [...l, ...(r.ok ? [cmd(`STOR ${x.name}`), res("150 Accepted data connection"), res("226 File successfully transferred"), st(t("fg.log.transferred", { size: size(x.mb), secs }))]
          : [cmd(`STOR ${x.name}`), err(t(r.error!, r.params)), err(t("fg.log.transferFailed"))])]);
        setDone((d) => [...d, { ...x, error: r.ok ? undefined : r.error }]);
        setQueue((q) => q.filter((y) => y.id !== x.id));
      }
    }, 250);
    return () => clearInterval(id);
  }, [queue, session, attempt]);

  const upload = (f: DownloadedFile) => {
    const mbps = uploadMbps(game);
    if (!session || !mbps) return;
    setLog((l) => [...l, st(t("fg.log.upload", { file: `${LOCAL_DIR}${f.name}` }))]);
    setQueue((q) => [...q, { id: nextId.current++, file: f.id, name: f.name, mb: f.mb, dir: cwd, start: nowHours(game), hours: transferHours(f.mb, mbps) }]);
  };

  const rel = (p: string) => (session ? `/${p.slice(session.root.length + 1)}` : "");
  const remoteOf = (x: Transfer) => `${rel(x.dir)}/${x.name}`.replace(/^\/\//, "/");
  const entries = ws ? Object.entries(ws.files).filter(([p]) => p.startsWith(`${cwd}/`) && !p.slice(cwd.length + 1).includes("/")).sort(([a, x], [b, y]) => Number(!!y.dir) - Number(!!x.dir) || a.localeCompare(b)) : [];
  const files = downloadedFiles(game), now = nowHours(game);
  const shown = tab === "queued" ? queue : done.filter((x) => (tab === "failed") === !!x.error);

  return (
    <div className="fg">
      <form className="fg-quick" onSubmit={(e) => { e.preventDefault(); connect(); }}>
        <label>{t(old ? "fg.address" : "fg.host")}<input value={host} onChange={(e) => setHost(e.target.value)} /></label>
        <label>{t(old ? "fg.user" : "fg.username")}<input value={user} onChange={(e) => setUser(e.target.value)} /></label>
        <label>{t("fg.password")}<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        <label>{t("fg.port")}<input className="fg-port" value={port} onChange={(e) => setPort(e.target.value)} /></label>
        {sftpEra && <label><input type="checkbox" checked={sftp} onChange={(e) => setSftp(e.target.checked)} />SFTP</label>}
        <button type="submit">{t("fg.quickconnect")}</button>
        {session && <button type="button" onClick={disconnect}>{t("fg.disconnect")}</button>}
      </form>
      <div className="fg-log" role="log">
        {log.map((l, i) => <div key={i} className={`fg-${l.kind}`}><span>{t(`fg.kind.${l.kind}`)}</span>{l.text}</div>)}
        <div ref={logEnd} />
      </div>
      <div className="fg-panes">
        <section>
          <header>{t("fg.localSite")} <input readOnly value={LOCAL_DIR} /></header>
          <table>
            <thead><tr><th>{t("fg.filename")}</th><th>{t("fg.filesize")}</th><th>{t("fg.filetype")}</th><th>{t("fg.modified")}</th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name} className={picked === f.name ? "on" : undefined} onClick={() => setPicked(f.name)} onDoubleClick={() => upload(f)}>
                  <td><File size={13} aria-hidden /> {f.name}</td><td className="num">{size(f.mb)}</td><td>{typeOf(f.name)}</td><td />
                </tr>
              ))}
            </tbody>
          </table>
          <footer><button disabled={!session || !files.some((f) => f.name === picked)} onClick={() => upload(files.find((f) => f.name === picked)!)}>{t("fg.upload")}</button></footer>
        </section>
        <section>
          <header>{t("fg.remoteSite")} <input readOnly value={rel(cwd)} /></header>
          {!ws ? <p className="fg-empty">{t("fg.notConnected")}</p> : (
            <table>
              <thead><tr><th>{t("fg.filename")}</th><th>{t("fg.filesize")}</th><th>{t("fg.filetype")}</th><th>{t("fg.modified")}</th><th>{t("fg.permissions")}</th><th>{t("fg.owner")}</th></tr></thead>
              <tbody>
                {cwd !== session.root && <tr onDoubleClick={() => setCwd(cwd.slice(0, cwd.lastIndexOf("/")))}><td><Folder size={13} aria-hidden /> ..</td><td /><td /><td /><td /><td /></tr>}
                {entries.map(([p, f]) => (
                  <tr key={p} onDoubleClick={() => f.dir && setCwd(p)}>
                    <td>{f.dir ? <Folder size={13} aria-hidden /> : <File size={13} aria-hidden />} {p.slice(cwd.length + 1)}</td>
                    <td className="num">{f.dir ? "" : size(f.mb)}</td><td>{f.dir ? t("fg.folder") : typeOf(p)}</td><td>{when(f.at)}</td>
                    <td className="mono">{f.dir ? "0755" : "0644"}</td><td className="mono">{ws.account} {ws.account}</td>
                  </tr>
                ))}
                {!entries.length && cwd === session.root && <tr><td colSpan={6} className="fg-empty">{t("fg.emptyDir")}</td></tr>}
              </tbody>
            </table>
          )}
        </section>
      </div>
      <div className="fg-queue">
        <table>
          <thead><tr><th>{t("fg.qLocal")}</th><th>{t("fg.qDirection")}</th><th>{t("fg.qRemote")}</th><th>{t("fg.qSize")}</th><th>{t("fg.qStatus")}</th></tr></thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id}>
                <td>{`${LOCAL_DIR}${x.name}`}</td><td>{"-->>"}</td><td>{remoteOf(x)}</td><td className="num">{size(x.mb)}</td>
                <td>{tab === "queued" ? <progress max={1} value={Math.min(1, (now - x.start) / x.hours)} /> : x.error ? t(x.error) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <nav>
          <button className={tab === "queued" ? "on" : undefined} onClick={() => setTab("queued")}>{t("fg.queued", { n: queue.length })}</button>
          <button className={tab === "failed" ? "on" : undefined} onClick={() => setTab("failed")}>{t("fg.failed", { n: done.filter((x) => x.error).length })}</button>
          <button className={tab === "done" ? "on" : undefined} onClick={() => setTab("done")}>{t("fg.done", { n: done.filter((x) => !x.error).length })}</button>
        </nav>
      </div>
    </div>
  );
}
