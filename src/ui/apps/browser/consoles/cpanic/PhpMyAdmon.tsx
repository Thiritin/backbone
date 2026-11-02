import { Database, Home, LogOut, Table2 } from "lucide-react";
import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { findRows, importMaxMb, parseSql, rowsOf, SQL_FUNCTIONS, tablesOf, type DbRowView, type SqlFunction } from "../../../../../sim/60-infra/webdb";
import { webspaceOf, type Webspace } from "../../../../../sim/60-infra/webspace";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { editRow, exportDatabase, importDatabase } from "../../../../../sim/90-actions/webdb";
import { useStore } from "../../../../store";
import { sizeText } from "./MySqlDatabases";
import "./pma.css";

type Tab = "structure" | "browse" | "sql" | "export" | "import" | "edit";
type Note = { ok: boolean; text: string; sql?: string } | null;
const PAGE = 30;
const step = <T,>(year: number, list: [number, T][]): T => list.filter(([y]) => y <= year).pop()?.[1] ?? list[0][1];
const pmaVersion = (y: number) => step(y, [[2005, "2.6.4-pl4"], [2006, "2.8.2.4"], [2007, "2.10.3"], [2008, "2.11.9.4"], [2009, "3.2.4"], [2010, "3.3.9"], [2011, "3.4.9"], [2012, "3.5.5"], [2013, "4.0.10"], [2015, "4.4.15"], [2017, "4.7.7"], [2019, "4.9.4"], [2021, "5.1.1"], [2023, "5.2.1"]]);
const mysqlVersion = (y: number) => step(y, [[2005, "4.1.22-standard"], [2007, "5.0.45-community"], [2010, "5.1.56-community"], [2012, "5.5.40-cll"], [2015, "5.6.36-cll-lve"], [2018, "5.7.29"], [2021, "8.0.30"]]);
const cut = (v: string) => (v.length > 50 ? `${v.slice(0, 50)}...` : v);
const num = (n: number) => n.toLocaleString(LOCALE);
const quote = (v: string) => `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

// phpMyAdmon as cPanic opens it for one account: the database tree on the left, the tabs of the picked database or table
// on the right. The look follows the era: the classic frames until 2013, then the 4.x theme.
export function PhpMyAdmon({ game, workloadId, close }: { game: GameState; workloadId: string; close: () => void }) {
  const attempt = useStore((s) => s.attempt), ws = webspaceOf(game, workloadId), year = yearOf(game.hour);
  const [db, setDb] = useState<string | null>(null), [table, setTable] = useState<string | null>(null), [tab, setTab] = useState<Tab>("structure");
  const [offset, setOffset] = useState(0), [where, setWhere] = useState<[string, string] | null>(null), [editing, setEditing] = useState<DbRowView | null>(null);
  const [note, setNote] = useState<Note>(null), [sql, setSql] = useState(""), [shown, setShown] = useState<string[] | null>(null);
  if (!ws) return null;
  const look = year < 2013 ? "classic" : "theme", tables = db ? tablesOf(game, ws, db) : [], info = tables.find((x) => x.name === table);
  const go = (d: string | null, tb: string | null, to: Tab) => { setDb(d); setTable(tb); setTab(to); setOffset(0); setWhere(null); setNote(null); setShown(null); setSql(""); };
  const fail = (r: ActionResult, query?: string) => !r.ok && setNote({ ok: false, text: t(r.error, r.params), sql: query });
  const tabs: Tab[] = !db ? ["sql"] : table ? ["browse", "structure", "sql"] : ["structure", "sql", "export", "import"];

  const runSql = () => {
    if (!db) return;
    const q = parseSql(sql);
    setShown(null);
    if (q.kind === "error") return setNote({ ok: false, text: t("webdb.pma.e1064", { near: q.near }), sql });
    if (q.kind === "showTables") { setShown(tables.map((x) => x.name)); return setNote({ ok: true, text: t("webdb.pma.rowsShown", { from: 0, to: Math.max(0, tables.length - 1), total: tables.length, secs: "0.0002" }), sql }); }
    if (!tables.some((x) => x.name === q.table)) return setNote({ ok: false, text: t("webspace.error.noTable", { table: q.table }), sql });
    if (q.kind === "select") {
      setTable(q.table); setTab("browse"); setOffset(q.offset); setWhere(q.where ?? null);
      return setNote(null);
    }
    const tb = tables.find((x) => x.name === q.table)!, key = tb.cols[0];
    const pks = key.name === q.where[0] && key.gen === "id" ? [Number(q.where[1])].filter((n) => n >= 1 && n <= tb.rows) : findRows(game, ws, db, q.table, q.where[0], q.where[1]).map((r) => r.pk);
    for (const pk of pks) {
      const r = attempt(editRow, workloadId, db, q.table, pk, q.set, q.fns);
      if (!r.ok) return fail(r, sql);
    }
    setNote({ ok: true, text: t("webdb.pma.affected", { n: pks.length }), sql });
  };

  const body = () => {
    if (!db) return <HomePage ws={ws} year={year} />;
    if (tab === "edit" && editing && info) return (
      <EditRow row={editing} cols={info.cols} onSave={(values, fns) => {
        const changed = Object.fromEntries(Object.entries(values).filter(([c, v]) => v !== editing.values[c] || fns[c]));
        const query = `UPDATE \`${info.name}\` SET ${Object.entries(changed).map(([c, v]) => `\`${c}\` = ${fns[c] ? `${fns[c]}(${quote(v)})` : quote(v)}`).join(", ")} WHERE \`${info.name}\`.\`${info.cols[0].name}\` = ${quote(editing.values[info.cols[0].name])};`;
        const r = attempt(editRow, workloadId, db, info.name, editing.pk, changed, fns);
        if (!r.ok) return fail(r, query);
        setTab("browse");
        setNote({ ok: true, text: t("webdb.pma.affected", { n: Object.keys(changed).length ? 1 : 0 }), sql: query });
      }} />
    );
    if (tab === "browse" && info) {
      const rows = where ? findRows(game, ws, db, info.name, where[0], where[1]).slice(0, PAGE) : rowsOf(game, ws, db, info.name, offset, PAGE);
      const total = where ? rows.length : info.rows, last = Math.max(0, Math.ceil(total / PAGE) - 1) * PAGE;
      const query = `SELECT * FROM \`${info.name}\`${where ? ` WHERE \`${where[0]}\` = ${quote(where[1])}` : ""} LIMIT ${offset}, ${PAGE}`;
      if (!rows.length) return <Message ok text={t("webdb.pma.empty")} sql={query} />;
      return (
        <>
          <Message ok text={t("webdb.pma.rowsShown", { from: offset, to: offset + rows.length - 1, total: num(total), secs: (0.0003 + info.rows * 2e-8).toFixed(4) })} sql={query} />
          {!where && total > PAGE && (
            <div className="pma-pager">
              <button disabled={offset === 0} onClick={() => setOffset(0)}>{"<<"}</button>
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>{"<"}</button>
              <select value={offset} onChange={(e) => setOffset(+e.target.value)} aria-label={t("webdb.pma.page")}>
                {Array.from({ length: Math.min(200, last / PAGE + 1) }, (_, i) => <option key={i} value={i * PAGE}>{i + 1}</option>)}
                {last / PAGE >= 200 && offset / PAGE >= 200 && <option value={offset}>{offset / PAGE + 1}</option>}
              </select>
              <button disabled={offset >= last} onClick={() => setOffset(Math.min(last, offset + PAGE))}>{">"}</button>
              <button disabled={offset >= last} onClick={() => setOffset(last)}>{">>"}</button>
            </div>
          )}
          <div className="pma-scroll">
            <table className="pma-data">
              <thead><tr><th />{info.cols.map((c) => <th key={c.name}>{c.name}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.pk}>
                  <td><button className="pma-link" onClick={() => { setEditing(r); setTab("edit"); setNote(null); }}>{t("webdb.pma.edit")}</button></td>
                  {info.cols.map((c) => <td key={c.name} className={/int|decimal/.test(c.type) ? "num" : undefined}>{cut(r.values[c.name])}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      );
    }
    if (tab === "structure" && info) return (
      <table className="pma-data">
        <thead><tr><th>#</th><th>{t("webdb.pma.name")}</th><th>{t("webdb.pma.type")}</th><th>{t("webdb.pma.collation")}</th><th>{t("webdb.pma.null")}</th><th>{t("webdb.pma.default")}</th><th>{t("webdb.pma.extra")}</th></tr></thead>
        <tbody>{info.cols.map((c, i) => (
          <tr key={c.name}>
            <td className="num">{i + 1}</td><td>{i === 0 ? <u>{c.name}</u> : c.name}</td><td>{c.type}</td>
            <td>{/char|text/.test(c.type) ? info.collation : ""}</td><td>{t("webdb.pma.no")}</td><td><i>{t("webdb.pma.none")}</i></td><td>{i === 0 && c.gen === "id" ? "auto_increment" : ""}</td>
          </tr>
        ))}</tbody>
      </table>
    );
    if (tab === "structure") {
      if (!tables.length) return <p className="pma-notice">{t("webdb.pma.noTables")}</p>;
      const rows = tables.reduce((a, x) => a + x.rows, 0), mb = tables.reduce((a, x) => a + x.mb, 0);
      return (
        <table className="pma-data">
          <thead><tr><th>{t("webdb.pma.table")}</th><th>{t("webdb.pma.action")}</th><th>{t("webdb.pma.records")}</th><th>{t("webdb.pma.engine")}</th><th>{t("webdb.pma.collation")}</th><th>{t("webdb.pma.size")}</th><th>{t("webdb.pma.overhead")}</th></tr></thead>
          <tbody>{tables.map((x) => (
            <tr key={x.name}>
              <td><button className="pma-link" onClick={() => go(db, x.name, "browse")}>{x.name}</button></td>
              <td className="pma-acts"><button className="pma-link" onClick={() => go(db, x.name, "browse")}>{t("webdb.pma.browse")}</button> <button className="pma-link" onClick={() => go(db, x.name, "structure")}>{t("webdb.pma.structure")}</button></td>
              <td className="num">{num(x.rows)}</td><td>{x.engine}</td><td>{x.collation}</td><td className="num">{sizeText(x.mb)}</td><td className="num">-</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><th>{t("webdb.pma.tablesCount", { n: tables.length })}</th><th>{t("webdb.pma.sum")}</th><th className="num">{num(rows)}</th><th>{tables[0].engine}</th><th>{tables[0].collation}</th><th className="num">{sizeText(mb)}</th><th className="num">0 B</th></tr></tfoot>
        </table>
      );
    }
    if (tab === "sql") return (
      <>
        <form className="pma-box" onSubmit={(e) => { e.preventDefault(); runSql(); }}>
          <h3>{t("webdb.pma.runSql", { db })}</h3>
          <textarea rows={8} value={sql} spellCheck={false} onChange={(e) => setSql(e.target.value)} placeholder={table ? `SELECT * FROM \`${table}\` WHERE 1` : undefined} />
          <p className="pma-go"><button type="submit">{t("webdb.pma.go")}</button></p>
        </form>
        {shown && (
          <table className="pma-data">
            <thead><tr><th>{`Tables_in_${db}`}</th></tr></thead>
            <tbody>{shown.map((n) => <tr key={n}><td>{n}</td></tr>)}</tbody>
          </table>
        )}
      </>
    );
    if (tab === "export") return <ExportTab onGo={(gzip) => {
      const r = attempt(exportDatabase, workloadId, db, gzip);
      if (!r.ok) return fail(r);
      setNote({ ok: true, text: t("webdb.pma.downloaded", { file: r.id! }) });
    }} />;
    if (tab === "import") return <ImportTab game={game} year={year} onGo={(file) => {
      const r = attempt(importDatabase, workloadId, db, file);
      if (!r.ok) return fail(r);
      const after = tablesOf(useStore.getState().game, webspaceOf(useStore.getState().game, workloadId)!, db);
      setNote({ ok: true, text: t("webdb.pma.imported", { n: after.length * 2 + after.reduce((a, x) => a + Math.ceil(x.rows / 500), 0), file }) });
    }} />;
    return null;
  };

  return (
    <div className="pma" data-look={look}>
      <nav className="pma-nav">
        <div className="pma-logo"><span>php</span>MyAdmon</div>
        <div className="pma-icons">
          <button aria-label={t("webdb.pma.home")} title={t("webdb.pma.home")} onClick={() => go(null, null, "structure")}><Home size={14} /></button>
          <button aria-label={t("webdb.pma.logout")} title={t("webdb.pma.logout")} onClick={close}><LogOut size={14} /></button>
        </div>
        <ul className="pma-tree">
          {Object.keys(ws.databases).sort().map((d) => (
            <li key={d}>
              <button aria-current={db === d && !table} onClick={() => go(d, null, "structure")}><Database size={13} aria-hidden />{d}</button>
              {db === d && (
                <ul>{tablesOf(game, ws, d).map((x) => (
                  <li key={x.name}><button aria-current={table === x.name} onClick={() => go(d, x.name, "browse")}><Table2 size={12} aria-hidden />{x.name}</button></li>
                ))}</ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <main className="pma-main">
        <div className="pma-crumb">
          <button className="pma-link" onClick={() => go(null, null, "structure")}>{t("webdb.pma.server", { host: "localhost" })}</button>
          {db && <>{" » "}<button className="pma-link" onClick={() => go(db, null, "structure")}>{t("webdb.pma.db", { db })}</button></>}
          {table && <>{" » "}<span>{t("webdb.pma.tableCrumb", { table })}</span></>}
        </div>
        {db && (
          <div className="pma-tabs" role="tablist">
            {tabs.map((x) => <button key={x} role="tab" aria-selected={tab === x || (x === "browse" && tab === "edit")} onClick={() => { setTab(x); setNote(null); setShown(null); setWhere(null); setOffset(0); }}>{t(`webdb.pma.${x}`)}</button>)}
          </div>
        )}
        {note && <Message {...note} />}
        {body()}
        <footer className="pma-foot">{`phpMyAdmon ${pmaVersion(year)}`}</footer>
      </main>
    </div>
  );
}

function Message({ ok, text, sql }: { ok: boolean; text: string; sql?: string }) {
  return (
    <div className={ok ? "pma-ok" : "pma-error"}>
      {!ok && <h4>{t("webdb.pma.error")}</h4>}
      {ok && <p>{text}</p>}
      {sql && <>{!ok && <p><b>{t("webdb.pma.sqlQuery")}</b></p>}<code className="pma-sql">{sql}</code></>}
      {!ok && <p><b>{t("webdb.pma.mysqlSaid")}</b> {text}</p>}
    </div>
  );
}

function HomePage({ ws, year }: { ws: Webspace; year: number }) {
  return (
    <div className="pma-home">
      <section className="pma-box">
        <h3>{t("webdb.pma.dbServer")}</h3>
        <ul>
          <li>{t("webdb.pma.serverLine")}</li>
          <li>{t("webdb.pma.serverVersion", { v: mysqlVersion(year) })}</li>
          <li>{t("webdb.pma.userLine", { user: `${ws.account}@localhost` })}</li>
        </ul>
      </section>
      <section className="pma-box">
        <h3>phpMyAdmon</h3>
        <ul><li>{t("webdb.pma.versionLine", { v: pmaVersion(year) })}</li></ul>
      </section>
    </div>
  );
}

const LONG = /text|blob/;
function EditRow({ row, cols, onSave }: { row: DbRowView; cols: { name: string; type: string }[]; onSave: (values: Record<string, string>, fns: Record<string, SqlFunction>) => void }) {
  const [values, setValues] = useState(row.values), [fns, setFns] = useState<Record<string, SqlFunction>>({});
  return (
    <form className="pma-box" onSubmit={(e) => { e.preventDefault(); onSave(values, fns); }}>
      <table className="pma-data pma-edit">
        <thead><tr><th>{t("webdb.pma.column")}</th><th>{t("webdb.pma.type")}</th><th>{t("webdb.pma.function")}</th><th>{t("webdb.pma.value")}</th></tr></thead>
        <tbody>{cols.map((c) => (
          <tr key={c.name}>
            <th scope="row">{c.name}</th>
            <td>{c.type}</td>
            <td>
              <select aria-label={t("webdb.pma.function")} value={fns[c.name] ?? ""} onChange={(e) => {
                const { [c.name]: _, ...rest } = fns;
                setFns(e.target.value ? { ...rest, [c.name]: e.target.value as SqlFunction } : rest);
              }}>
                <option value="" />
                {SQL_FUNCTIONS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </td>
            <td>{LONG.test(c.type)
              ? <textarea aria-label={c.name} rows={3} value={values[c.name]} onChange={(e) => setValues({ ...values, [c.name]: e.target.value })} />
              : <input aria-label={c.name} value={values[c.name]} onChange={(e) => setValues({ ...values, [c.name]: e.target.value })} />}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="pma-go"><button type="submit">{t("webdb.pma.go")}</button></p>
    </form>
  );
}

function ExportTab({ onGo }: { onGo: (gzip: boolean) => void }) {
  const [custom, setCustom] = useState(false), [gzip, setGzip] = useState(false);
  return (
    <form className="pma-box" onSubmit={(e) => { e.preventDefault(); onGo(custom && gzip); }}>
      <h3>{t("webdb.pma.exportMethod")}</h3>
      <label><input type="radio" checked={!custom} onChange={() => setCustom(false)} /> {t("webdb.pma.quick")}</label>
      <label><input type="radio" checked={custom} onChange={() => setCustom(true)} /> {t("webdb.pma.custom")}</label>
      <h3>{t("webdb.pma.format")}</h3>
      <select aria-label={t("webdb.pma.format")}><option>SQL</option></select>
      {custom && (
        <>
          <h3>{t("webdb.pma.compression")}</h3>
          <select aria-label={t("webdb.pma.compression")} value={gzip ? "gzip" : "none"} onChange={(e) => setGzip(e.target.value === "gzip")}>
            <option value="none">{t("webdb.pma.compressNone")}</option>
            <option value="gzip">{t("webdb.pma.gzipped")}</option>
          </select>
        </>
      )}
      <p className="pma-go"><button type="submit">{t("webdb.pma.go")}</button></p>
    </form>
  );
}

function ImportTab({ game, year, onGo }: { game: GameState; year: number; onGo: (file: string) => void }) {
  const files = [...game.media.files].sort(), [file, setFile] = useState("");
  const picked = file || files[0] || "";
  return (
    <form className="pma-box" onSubmit={(e) => { e.preventDefault(); onGo(picked); }}>
      <h3>{t("webdb.pma.fileToImport")}</h3>
      <label>{t("webdb.pma.browseComputer")}{" "}
        <select value={picked} onChange={(e) => setFile(e.target.value)}>
          {!files.length && <option value="">{t("webdb.pma.noFile")}</option>}
          {files.map((f) => <option key={f}>{f}</option>)}
        </select>
        {" "}{t("webdb.pma.max", { kb: num(importMaxMb(year) * 1024) })}
      </label>
      <p>{t("webdb.pma.charset")} <select aria-label={t("webdb.pma.charset")}><option>utf-8</option></select></p>
      <h3>{t("webdb.pma.format")}</h3>
      <select aria-label={t("webdb.pma.format")}><option>SQL</option></select>
      <p className="pma-go"><button type="submit">{t("webdb.pma.go")}</button></p>
    </form>
  );
}
