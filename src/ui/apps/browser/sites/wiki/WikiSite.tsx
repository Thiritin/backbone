import { t } from "../../../../../i18n/en";
import { useState, type ReactNode } from "react";
import type { GameState } from "../../../../../sim/50-state";
import { WIKI_URL } from "../../../../../sim/80-business/browser";
import { yearOf } from "../../../../../sim/00-core/time";
import { A, ARTICLES, articleBySlug, CATEGORIES, rich, W, wikiUrl, type Article, type Go } from "./articles";
import "./wiki.css";

const SEARCH = "Special:Search";
const catLabel = (c: string) => t(`browser-sites-2.wikiCat_${c}`);

const list = (items: Article[], go: Go) => <ul>{items.map((a) => <li key={a.slug}><W slug={a.slug} go={go}>{a.title}</W></li>)}</ul>;
const inCategory = (c: string) => ARTICLES.filter((a) => a.category === c);
const matches = (q: string) => ARTICLES.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()));

function MainPage({ go }: { go: Go }) {
  return <>
    <p>{rich(t("browser-sites-2.wikiWelcome"), go)}</p>
    {CATEGORIES.map((c) => <section key={c}><h2>{catLabel(c)}</h2>{list(inCategory(c), go)}</section>)}
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
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("browser-sites-2.wikiSearch")} aria-label={t("browser-sites-2.wikiSearch")} />
      <button type="submit">{t("browser-sites-2.wikiGo")}</button>
    </form>
  );
}

function page({ slug, query, go, year }: { slug: string; query: string; go: Go; year: number }): { title: string; body: ReactNode; article?: boolean } {
  if (slug === "Main_Page") return { title: t("browser-sites-2.wikiMainPage"), body: <MainPage go={go} /> };
  if (slug === SEARCH) {
    const q = new URLSearchParams(query).get("search") ?? "";
    const hits = matches(q);
    return { title: t("browser-sites-2.wikiResults"), body: hits.length ? list(hits, go) : <p>{t("browser-sites-2.wikiNoResults")}</p> };
  }
  const cat = CATEGORIES.find((c) => `Category:${c}`.toLowerCase() === slug.toLowerCase());
  if (cat) return { title: t("browser-sites-2.wikiCategory", { name: catLabel(cat) }), body: <><p>{t("browser-sites-2.wikiInCategory")}</p>{list(inCategory(cat), go)}</> };
  const a = articleBySlug(slug);
  if (a) return { title: a.title, body: <>{a.body(go, year)}<div className="wk-cat">{rich(t("browser-sites-2.wikiCategoryLink", { slug: `Category:${a.category}`, name: catLabel(a.category) }), go)}</div></>, article: true };
  return { title: slug.replace(/_/g, " "), body: <p>{t("browser-sites-2.wikiNoArticle")}</p>, article: true };
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
          <li><A to={WIKI_URL} go={go}>{t("browser-sites-2.wikiMainPage")}</A></li>
          <li><a href="#random" onClick={(e) => { e.preventDefault(); random(); }}>{t("browser-sites-2.wikiRandom")}</a></li>
          <li><W slug="Help:Starting_a_hosting_company" go={go}>{catLabel("Help")}</W></li>
        </ul>
        <ul>
          {CATEGORIES.filter((c) => c !== "Help").map((c) => <li key={c}><W slug={`Category:${c}`} go={go}>{catLabel(c)}</W></li>)}
        </ul>
      </nav>
      <main className="wk-page">
        <h1>{title}</h1>
        {article && <div className="wk-from">{t("browser-sites-2.wikiFrom")}</div>}
        {body}
      </main>
    </div>
  );
}
