import { t } from "../../i18n/en";
import { ChevronLeft } from "lucide-react";
import { useRef, useState, type FocusEvent } from "react";
import { euro } from "../../sim/00-core/money";
import { weeklyChallenge, type Twist } from "../../sim/10-catalog/challenges";
import { datacenterById, homeLineById } from "../../sim/20-world/datacenters";
import { LANGS, lang, setLang, type Lang } from "../../i18n/lang";
import { versionLabel } from "../changelog";
import { EMBEDDED } from "../embedded";
import { isNew, loadSeen, markRead, saveSeen } from "../news-seen";
import { DISCORD_URL, uiSound, useStore, type Theme } from "../store";
import { Wordmark } from "../art/Wordmark";
import { Intro } from "./Intro";
import "./menu.css";

const twistLabel = (w: Twist): string =>
  w.kind === "line" ? t("core.twistLine", { name: homeLineById(w.line).name }) : w.kind === "dc" ? t("core.twistDc", { name: datacenterById(w.dc).name }) : t("core.twistCash", { cash: euro(w.cash) });

// Menu buttons tick when pointed at or reached by keyboard, and chime when chosen.
const hear = {
  onPointerEnter: () => uiSound("hover"),
  onFocus: (e: FocusEvent<HTMLElement>) => e.currentTarget.matches(":focus-visible") && uiSound("hover"),
};
const choose = (fn: () => void, kind: "select" | "back" = "select") => () => { uiSound(kind); fn(); };

const THEMES: [Theme, string][] = [["light", t("apps.settings.light")], ["dark", t("apps.settings.dark")], ["auto", t("apps.settings.auto")]];

function News() {
  const [seen, setSeen] = useState(() => loadSeen(EMBEDDED[0]?.version ?? 0));
  const read = (version: number) => {
    const next = markRead(seen, version);
    if (next !== seen) { setSeen(next); saveSeen(next); }
  };
  return (
    <aside className="menu-news">
      <h2>{t("desktop.start.news")}</h2>
      <div className="menu-versions">
        {EMBEDDED.map((d, n) => {
          const fresh = isNew(seen, d.version ?? 0);
          return (
            <details key={d.date} open={n === 0 || undefined}>
              <summary {...hear} onClick={() => { uiSound("hover"); read(d.version ?? 0); }}>
                <span>{t("desktop.changes.version", { version: versionLabel(d.date) })}</span>
                <small>{d.date}</small>
                {fresh && <b className="menu-new">{t("desktop.start.new")}</b>}
              </summary>
              <ul>{d.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </details>
          );
        })}
      </div>
    </aside>
  );
}

function SettingsPage({ onBack }: { onBack: () => void }) {
  const { theme, setTheme } = useStore();
  return (
    <section className="menu-page">
      <button className="btn ghost" {...hear} onClick={choose(onBack, "back")}><ChevronLeft />{t("desktop.start.back")}</button>
      <h3>{t("desktop.menu.language")}</h3>
      <div className="picks">
        {Object.entries(LANGS).map(([id, name]) => (
          <button key={id} className="pick" {...hear} aria-pressed={lang === id} onClick={() => { uiSound("select"); setLang(id as Lang); }}><strong>{name}</strong></button>
        ))}
      </div>
      <h3>{t("apps.settings.theme")}</h3>
      <div className="picks three">
        {THEMES.map(([id, label]) => (
          <button key={id} className="pick" {...hear} aria-pressed={theme === id} onClick={() => { uiSound("select"); setTheme(id); }}><strong>{label}</strong></button>
        ))}
      </div>
    </section>
  );
}

export function StartScreen() {
  const { startGame, startChallenge, importSave, canContinue, continueGame } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(false);
  const [page, setPage] = useState<"main" | "settings">("main");
  const week = weeklyChallenge(new Date());
  return (
    <main className="menu">
      <h1 className="menu-title"><Wordmark /></h1>
      {page === "settings" ? <SettingsPage onBack={() => setPage("main")} /> :
        <nav className="menu-bars">
          {canContinue && <button className="btn primary" autoFocus {...hear} onClick={choose(continueGame)}>{t("desktop.start.continue")}</button>}
          <button className={`btn${canContinue ? "" : " primary"}`} autoFocus={!canContinue} {...hear} onClick={choose(startGame)}>{t("desktop.newGame")}</button>
          <button className="btn" {...hear} onClick={choose(startChallenge)}><span>{t("desktop.start.weekly")}<small>{week.id} · {twistLabel(week.twist)}</small></span></button>
          <button className="btn" {...hear} onClick={choose(() => file.current?.click())}>{t("desktop.start.import")}</button>
          <button className="btn" {...hear} onClick={choose(() => setIntro(true))}>{t("desktop.start.intro")}</button>
          <button className="btn" {...hear} onClick={choose(() => setPage("settings"))}>{t("desktop.start.settings")}</button>
          <button className="btn" {...hear} onClick={choose(() => { window.open(DISCORD_URL, "_blank", "noopener"); })}>{t("desktop.start.discord")}</button>
        </nav>}
      <News />
      {intro && <Intro dark onClose={() => setIntro(false)} />}
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) importSave(await f.text());
      }} />
    </main>
  );
}
