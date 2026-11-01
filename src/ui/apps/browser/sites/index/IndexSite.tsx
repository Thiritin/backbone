import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { dirSlug as slug, HOME_URL, INDEX_HOST, resolve } from "../../../../../sim/80-business/browser";
import { siteIndex, type Category, type IndexRow } from "../../../../../sim/80-business/index";
import { Favicon } from "../../Favicon";
import { eraOf } from "../era";
import "./index.css";

const ERAS = [{ from: 2005, look: "early" as const }, { from: 2013, look: "late" as const }];

function Row({ r, go, game, fav }: { r: IndexRow; go: (url: string) => void; game: GameState; fav?: boolean }) {
  return (
    <li className={r.down ? "down" : undefined}>
      {fav && <Favicon game={game} r={resolve(game, r.url)} />}
      <a href={`#${r.url}`} onClick={(e) => { e.preventDefault(); go(r.url); }}>{r.title}</a>
      <span className="yx-desc">{r.down ? t("browser-sites-1.ix.down") : r.desc}</span>
    </li>
  );
}

// docs/design/software.md, 8.2: the start page. The search box filters the directory; it searches nothing else.
export function IndexSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const [q, setQ] = useState("");
  const look = eraOf(ERAS, yearOf(game.hour)), all = siteIndex(game), needle = q.trim().toLowerCase();
  const hit = (r: IndexRow) => `${r.title} ${r.desc}`.toLowerCase().includes(needle);
  const cats: Category[] = needle ? all.map((c) => ({ ...c, rows: c.title.toLowerCase().includes(needle) ? c.rows : c.rows.filter(hit) })).filter((c) => c.rows.length) : all;
  const open = !needle && look === "early" ? all.find((c) => `/dir/${slug(c.title)}` === path.replace(/\/$/, "")) : undefined;
  const search = (
    <form className="yx-search" role="search" onSubmit={(e) => e.preventDefault()}>
      <input aria-label={t("browser-sites-1.ix.searchLabel")} value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} />
      <button className="yx-go">{t("browser-sites-1.ix.search")}</button>
    </form>
  );
  const mark = <a className="yx-mark" href={`#${HOME_URL}`} onClick={(e) => { e.preventDefault(); setQ(""); go(HOME_URL); }}>Yahoy!</a>;
  if (look === "late") {
    return (
      <div className="yx yx-late">
        <header>{mark}{search}</header>
        <div className="yx-cards">
          {cats.map((c) => (
            <section key={c.title} className="yx-card">
              <h2>{c.title}</h2>
              <ul>{c.rows.map((r) => <Row key={r.url} r={r} go={go} game={game} fav />)}</ul>
            </section>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="yx yx-early">
      <header>{mark}{search}</header>
      {open ? (
        <section className="yx-cat">
          <p className="yx-crumb"><a href={`#${HOME_URL}`} onClick={(e) => { e.preventDefault(); go(HOME_URL); }}>{t("browser-sites-1.ix.home")}</a> &gt; {open.title}</p>
          <h2>{open.title}</h2>
          <ul>{open.rows.map((r) => <Row key={r.url} r={r} go={go} game={game} />)}</ul>
        </section>
      ) : needle ? (
        <section className="yx-cat">
          {cats.map((c) => <div key={c.title}><h2>{c.title}</h2><ul>{c.rows.map((r) => <Row key={r.url} r={r} go={go} game={game} />)}</ul></div>)}
          {!cats.length && <p>{t("browser-sites-1.ix.noMatch")}</p>}
        </section>
      ) : (
        <ul className="yx-dir">
          {all.map((c) => (
            <li key={c.title}>
              <a href={`#${c.title}`} onClick={(e) => { e.preventDefault(); go(`www.${INDEX_HOST}/dir/${slug(c.title)}`); }}>{c.title}</a> <span>({c.rows.length})</span>
            </li>
          ))}
        </ul>
      )}
      <footer>{t("browser-sites-1.ix.copyright", { year: yearOf(game.hour) })}</footer>
    </div>
  );
}
