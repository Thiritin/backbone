import { useEffect, useState } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { dirSlug as slug, HOME_URL, INDEX_HOST, resolve, WIKI_TITLE } from "../../../../../sim/80-business/browser";
import { searchIndex, siteIndex, type IndexRow, type SearchHit } from "../../../../../sim/80-business/index";
import { ARTICLES, wikiUrl } from "../wiki/articles";
import { Favicon } from "../../Favicon";
import { eraOf } from "../era";
import "./index.css";

const ERAS = [{ from: 2005, look: "early" as const }, { from: 2013, look: "late" as const }];

function Row({ r, go, game, fav, ad }: { r: IndexRow; go: (url: string) => void; game: GameState; fav?: boolean; ad?: boolean }) {
  return (
    <li className={r.down ? "down" : ad ? "yx-ad" : undefined}>
      {fav && <Favicon game={game} r={resolve(game, r.url)} />}
      <a href={`#${r.url}`} onClick={(e) => { e.preventDefault(); go(r.url); }}>{r.title}</a>
      {ad && <span className="yx-tag">{t("browser-sites-1.ix.ad")}</span>}
      <span className="yx-desc">{r.down ? t("browser-sites-1.ix.down") : r.desc}</span>
    </li>
  );
}

const queryOf = (path: string): string => (path.startsWith("/search") ? new URLSearchParams(path.split("?")[1] ?? "").get("p") ?? "" : "");

// docs/design/software.md, 8.2: the start page, a directory of the web by category, and its search: matching
// encyclopedia articles first, then the directory's matches with sponsored rows between them.
export function IndexSite({ game, path, go }: { game: GameState; path: string; go: (url: string) => void }) {
  const query = queryOf(path), [q, setQ] = useState(query);
  useEffect(() => setQ(query), [query]);
  const look = eraOf(ERAS, yearOf(game.hour)), [docsCat, ...dir] = siteIndex(game), all = [docsCat, ...dir], needle = query.trim().toLowerCase();
  const docs: IndexRow[] = needle ? ARTICLES.filter((a) => a.title.toLowerCase().includes(needle)).map((a) => ({ title: `${a.title} - ${WIKI_TITLE}`, url: wikiUrl(a.slug), desc: wikiUrl(a.slug), down: false })) : [];
  const hits: SearchHit[] = [...docs.map((row) => ({ row, ad: false })), ...searchIndex(game, query)];
  const open = !needle && look === "early" ? all.find((c) => `/dir/${slug(c.title)}` === path.replace(/\/$/, "")) : undefined;
  const search = (
    <form className="yx-search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(`www.${INDEX_HOST}/search?p=${encodeURIComponent(q.trim())}`); }}>
      <input aria-label={t("browser-sites-1.ix.searchLabel")} value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} />
      <button className="yx-go">{t("browser-sites-1.ix.search")}</button>
    </form>
  );
  const results = (
    <section className="yx-cat yx-results">
      <ul>{hits.map((h, i) => <Row key={`${i}-${h.row.url}`} r={h.row} go={go} game={game} fav={look === "late"} ad={h.ad} />)}</ul>
      {!hits.some((h) => !h.ad) && <p>{t("browser-sites-1.ix.noMatch")}</p>}
    </section>
  );
  // The encyclopedia stands above the directory as the documentation.
  const docsBox = (
    <section className="yx-docs">
      <h2>{docsCat.title}</h2>
      <ul>{docsCat.rows.map((r) => <Row key={r.url} r={r} go={go} game={game} fav />)}</ul>
    </section>
  );
  const mark = <a className="yx-mark" href={`#${HOME_URL}`} onClick={(e) => { e.preventDefault(); go(HOME_URL); }}>Yahoy!</a>;
  if (look === "late") {
    return (
      <div className="yx yx-late">
        <header>{mark}{search}</header>
        {needle ? results : <>{docsBox}<div className="yx-cards">
          {dir.map((c) => (
            <section key={c.title} className="yx-card">
              <h2>{c.title}</h2>
              <ul>{c.rows.map((r) => <Row key={r.url} r={r} go={go} game={game} fav />)}</ul>
            </section>
          ))}
        </div></>}
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
      ) : needle ? results : (<>
        {docsBox}
        <ul className="yx-dir">
          {dir.map((c) => (
            <li key={c.title}>
              <a href={`#${c.title}`} onClick={(e) => { e.preventDefault(); go(`www.${INDEX_HOST}/dir/${slug(c.title)}`); }}>{c.title}</a> <span>({c.rows.length})</span>
            </li>
          ))}
        </ul>
      </>)}
      <footer>{t("browser-sites-1.ix.copyright", { year: yearOf(game.hour) })}</footer>
    </div>
  );
}
