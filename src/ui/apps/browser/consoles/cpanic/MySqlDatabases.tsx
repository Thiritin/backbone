import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { ALL_PRIVILEGES, dbUserMax, webspaceOf } from "../../../../../sim/60-infra/webspace";
import { createDatabase, createDbUser, deleteDatabase, deleteDbUser, grantDb } from "../../../../../sim/90-actions/webspace";
import { usePageAct } from "../../pageAct";
import "./mysql.css";

// MySQL 5.1 added EVENT and TRIGGER; cPanel lists the privileges alphabetically.
const PRIVILEGES = ["ALTER", "ALTER ROUTINE", "CREATE", "CREATE ROUTINE", "CREATE TEMPORARY TABLES", "CREATE VIEW", "DELETE", "DROP", "EVENT", "EXECUTE", "INDEX", "INSERT", "LOCK TABLES", "REFERENCES", "SELECT", "SHOW VIEW", "TRIGGER", "UPDATE"];
const privilegesAt = (year: number) => PRIVILEGES.filter((p) => year >= 2008 || (p !== "EVENT" && p !== "TRIGGER"));

export const sizeText = (mb: number): string =>
  mb <= 0 ? t("webdb.bytes", { n: 0 }) : mb < 1 ? t("webdb.kb", { n: (mb * 1024).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) }) : t("webdb.mb", { n: mb.toLocaleString(LOCALE, { maximumFractionDigits: 2 }) });

// cPanel's strength meter: length and character classes, 0 to 100.
const strength = (p: string): number =>
  Math.min(100, p.length * 6 + [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length * 10 - (p.length ? 10 : 0));
const generate = (): string => Array.from({ length: 14 }, () => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%^*"[Math.floor(Math.random() * 61)]).join("");

type Confirm = { kind: "db" | "user"; name: string } | null;

// cPanic's MySQL Databases page: create a database, create a user, add the user to a database with privileges, and the
// current databases and users with their delete links. Databases always run on localhost.
export function MySqlDatabases({ game, workloadId }: { game: GameState; workloadId: string }) {
  const act = usePageAct(), ws = webspaceOf(game, workloadId), year = yearOf(game.hour);
  const [db, setDb] = useState(""), [user, setUser] = useState(""), [pass, setPass] = useState(""), [again, setAgain] = useState("");
  const [addUser, setAddUser] = useState(""), [addDb, setAddDb] = useState(""), [manage, setManage] = useState<{ user: string; db: string } | null>(null);
  const [picked, setPicked] = useState<string[]>([]), [done, setDone] = useState<string | null>(null), [confirm, setConfirm] = useState<Confirm>(null), [mismatch, setMismatch] = useState(false);
  if (!ws) return null;
  const dbs = Object.values(ws.databases), users = Object.values(ws.dbUsers), privs = privilegesAt(year);
  const run = (r: { ok: boolean }, message: string) => { if (r.ok) setDone(message); return r.ok; };
  const open = (u: string, d: string) => {
    const has = ws.dbUsers[u]?.grants[d] ?? [];
    setPicked(has.includes(ALL_PRIVILEGES[0]) ? privs : has);
    setManage({ user: u, db: d });
    setDone(null);
  };

  if (manage) {
    const all = privs.every((p) => picked.includes(p));
    const toggle = (p: string) => setPicked(picked.includes(p) ? picked.filter((x) => x !== p) : [...picked, p]);
    const save = () => {
      if (run(act(grantDb, workloadId, manage.user, manage.db, all ? ALL_PRIVILEGES : picked), t("webdb.privsSaved", { user: manage.user, db: manage.db }))) setManage(null);
    };
    return (
      <div className="cp-db">
        <h2>{t("webdb.managePrivs")}</h2>
        <dl className="cp-db-facts"><dt>{t("webdb.user")}</dt><dd>{manage.user}</dd><dt>{t("webdb.database")}</dt><dd>{manage.db}</dd></dl>
        <label className="cp-db-all"><input type="checkbox" checked={all} onChange={() => setPicked(all ? [] : privs)} /> {t("webdb.allPrivileges")}</label>
        <div className="cp-db-privs">
          {privs.map((p) => <label key={p}><input type="checkbox" checked={picked.includes(p)} onChange={() => toggle(p)} /> {p}</label>)}
        </div>
        <p className="cx-acts">
          <button className="cx-btn primary" onClick={save}>{t("webdb.makeChanges")}</button>
          <button className="cx-btn" onClick={() => setManage(null)}>{t("webdb.goBack")}</button>
        </p>
      </div>
    );
  }

  return (
    <div className="cp-db">
      <h1>{t("webdb.title")}</h1>
      {done && <p className="cp-db-done">{done}</p>}
      {confirm && (
        <div className="cp-db-confirm">
          <p>{confirm.kind === "db" ? t("webdb.confirmDb", { name: confirm.name }) : t("webdb.confirmUser", { name: confirm.name })}</p>
          <button className="cx-btn danger" onClick={() => {
            const r = confirm.kind === "db" ? act(deleteDatabase, workloadId, confirm.name) : act(deleteDbUser, workloadId, confirm.name);
            run(r, t(confirm.kind === "db" ? "webdb.dbDeleted" : "webdb.userDeleted", { name: confirm.name }));
            setConfirm(null);
          }}>{confirm.kind === "db" ? t("webdb.deleteDb") : t("webdb.deleteUser")}</button>
          <button className="cx-btn" onClick={() => setConfirm(null)}>{t("webdb.cancel")}</button>
        </div>
      )}

      <h2>{t("webdb.createDb")}</h2>
      <form className="cp-db-form" onSubmit={(e) => { e.preventDefault(); if (run(act(createDatabase, workloadId, db), t("webdb.dbAdded", { name: ws.prefix + db }))) setDb(""); }}>
        <label>{t("webdb.newDb")}<span className="cp-db-prefix">{ws.prefix}<input value={db} maxLength={64 - ws.prefix.length} onChange={(e) => setDb(e.target.value)} /></span></label>
        <button className="cx-btn primary" type="submit">{t("webdb.createDbBtn")}</button>
      </form>

      <h2>{t("webdb.currentDbs")}</h2>
      <table className="cx-table">
        <thead><tr><th>{t("webdb.database")}</th><th>{t("webdb.size")}</th><th>{t("webdb.privUsers")}</th><th>{t("webdb.actions")}</th></tr></thead>
        <tbody>
          {dbs.length === 0 && <tr><td colSpan={4} className="cx-empty">{t("webdb.noDbs")}</td></tr>}
          {dbs.map((d) => (
            <tr key={d.name}>
              <td>{d.name}</td>
              <td className="num">{sizeText(d.mb)}</td>
              <td>{users.filter((u) => u.grants[d.name]).map((u) => (
                <span key={u.name} className="cp-db-grant">
                  <button className="cx-link" onClick={() => open(u.name, d.name)}>{u.name}</button>
                  <button className="cx-link" aria-label={t("webdb.revoke", { user: u.name })} title={t("webdb.revoke", { user: u.name })}
                    onClick={() => run(act(grantDb, workloadId, u.name, d.name, []), t("webdb.revoked", { user: u.name, db: d.name }))}>×</button>
                </span>
              ))}</td>
              <td><button className="cx-link" onClick={() => setConfirm({ kind: "db", name: d.name })}>{t("webdb.delete")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t("webdb.users")}</h2>
      <h3>{t("webdb.addUser")}</h3>
      <form className="cp-db-form cp-db-grid" onSubmit={(e) => {
        e.preventDefault();
        setMismatch(pass !== again);
        if (pass !== again) return;
        if (run(act(createDbUser, workloadId, user, pass), t("webdb.userAdded", { name: ws.prefix + user, pass }))) { setUser(""); setPass(""); setAgain(""); }
      }}>
        <label>{t("webdb.username")}<span className="cp-db-prefix">{ws.prefix}<input value={user} maxLength={dbUserMax(year) - ws.prefix.length} onChange={(e) => setUser(e.target.value)} /></span></label>
        <label>{t("webdb.password")}<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        <label>{t("webdb.passwordAgain")}<input type="password" value={again} onChange={(e) => setAgain(e.target.value)} /></label>
        {mismatch && <p className="cx-note bad">{t("webdb.mismatch")}</p>}
        <div className="cp-db-strength">
          <span>{t("webdb.strength")}</span>
          <meter min={0} max={100} low={50} high={75} optimum={100} value={strength(pass)} />
          <span className="num">{strength(pass)}/100</span>
          <button type="button" className="cx-btn" onClick={() => { const p = generate(); setPass(p); setAgain(p); }}>{t("webdb.generator")}</button>
        </div>
        <button className="cx-btn primary" type="submit">{t("webdb.createUser")}</button>
      </form>

      <h3>{t("webdb.addToDb")}</h3>
      <form className="cp-db-form" onSubmit={(e) => { e.preventDefault(); const u = addUser || users[0]?.name, d = addDb || dbs[0]?.name; if (u && d) open(u, d); }}>
        <label>{t("webdb.user")}<select value={addUser || users[0]?.name || ""} onChange={(e) => setAddUser(e.target.value)}>{users.map((u) => <option key={u.name}>{u.name}</option>)}</select></label>
        <label>{t("webdb.database")}<select value={addDb || dbs[0]?.name || ""} onChange={(e) => setAddDb(e.target.value)}>{dbs.map((d) => <option key={d.name}>{d.name}</option>)}</select></label>
        <button className="cx-btn primary" type="submit" disabled={!users.length || !dbs.length}>{t("webdb.add")}</button>
      </form>

      <h3>{t("webdb.currentUsers")}</h3>
      <table className="cx-table">
        <thead><tr><th>{t("webdb.users")}</th><th>{t("webdb.host")}</th><th>{t("webdb.actions")}</th></tr></thead>
        <tbody>
          {users.length === 0 && <tr><td colSpan={3} className="cx-empty">{t("webdb.noUsers")}</td></tr>}
          {users.map((u) => (
            <tr key={u.name}>
              <td>{u.name}</td><td>localhost</td>
              <td><button className="cx-link" onClick={() => setConfirm({ kind: "user", name: u.name })}>{t("webdb.delete")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
