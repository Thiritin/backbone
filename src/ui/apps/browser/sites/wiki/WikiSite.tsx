import { useState, type ReactNode } from "react";
import type { GameState } from "../../../../../sim/50-state";
import { WIKI_URL } from "../../../../../sim/80-business/browser";
import { yearOf } from "../../../../../sim/00-core/time";
import { A, ARTICLES, articleBySlug, CATEGORIES, W, wikiUrl, type Article, type Go } from "./articles";
import "./wiki.css";

const SEARCH = "Special:Search";

const list = (items: Article[], go: Go) => <ul>{items.map((a) => <li key={a.slug}><W slug={a.slug} go={go}>{a.title}</W></li>)}</ul>;
const inCategory = (c: string) => ARTICLES.filter((a) => a.category === c);
const matches = (q: string) => ARTICLES.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()));

function MainPage({ go }: { go: Go }) {
  return <>
    <p>Welcome to <b>Wikipedio</b>, the free encyclopedia that anyone can edit. New to running servers? Start with <W slug="Help:Starting_a_hosting_company" go={go}>starting a hosting company</W>.</p>
    {CATEGORIES.map((c) => <section key={c}><h2>{c}</h2>{list(inCategory(c), go)}</section>)}
  </>;
}

function SearchBox({ go }: { go: Go }) {
  const [q, setQ] = useState("");
  const submit = () => {
    const term = q.trim();
    if (!term) return;
    const exact = ARTICLES.find((a) => a.title.toLowerCase() === term.toLowerCase());
    go(exact ? wikiUrl(exact.slug) : `${wikiUrl(SEARCH)}?search=${encodeURIComponent(term)}`);
  };
  return (
    <form className="wk-search" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wikipedio" aria-label="Search Wikipedio" />
      <button type="submit">Go</button>
    </form>
  );
}

function page({ slug, query, go, year }: { slug: string; query: string; go: Go; year: number }): { title: string; body: ReactNode; article?: boolean } {
  if (slug === "Main_Page") return { title: "Main Page", body: <MainPage go={go} /> };
  if (slug === SEARCH) {
    const q = new URLSearchParams(query).get("search") ?? "";
    const hits = matches(q);
    return { title: "Search results", body: hits.length ? list(hits, go) : <p>There were no results matching the query.</p> };
  }
  const cat = CATEGORIES.find((c) => `Category:${c}`.toLowerCase() === slug.toLowerCase());
  if (cat) return { title: `Category:${cat}`, body: <><p>The following pages are in this category.</p>{list(inCategory(cat), go)}</> };
  const a = articleBySlug(slug);
  if (a) return { title: a.title, body: <>{a.body(go, year)}<div className="wk-cat">Category: <W slug={`Category:${a.category}`} go={go}>{a.category}</W></div></>, article: true };
  return { title: slug.replace(/_/g, " "), body: <p>Wikipedio does not have an article with this exact name.</p>, article: true };
}

export function WikiSite({ game, path, go }: { game: GameState; path: string; go: Go }) {
  const [rest, query = ""] = path.split("?");
  const slug = decodeURIComponent(rest.replace(/^\/wiki\//, "").replace(/\/$/, "")) || "Main_Page";
  const { title, body, article } = page({ slug: rest === "/" ? "Main_Page" : slug, query, go, year: yearOf(game.hour) });
  const random = () => go(wikiUrl(ARTICLES[Math.floor(Math.random() * ARTICLES.length)].slug));
  return (
    <div className="wk">
      <nav className="wk-side">
        <A to={WIKI_URL} go={go}><span className="wk-logo">W</span><span className="wk-name">Wikipedio</span></A>
        <SearchBox key={path} go={go} />
        <ul>
          <li><A to={WIKI_URL} go={go}>Main Page</A></li>
          <li><a href="#random" onClick={(e) => { e.preventDefault(); random(); }}>Random article</a></li>
          <li><W slug="Help:Starting_a_hosting_company" go={go}>Help</W></li>
        </ul>
        <ul>
          {CATEGORIES.filter((c) => c !== "Help").map((c) => <li key={c}><W slug={`Category:${c}`} go={go}>{c}</W></li>)}
        </ul>
      </nav>
      <main className="wk-page">
        <h1>{title}</h1>
        {article && <div className="wk-from">From Wikipedio, the free encyclopedia</div>}
        {body}
      </main>
    </div>
  );
}
