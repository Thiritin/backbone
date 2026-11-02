import { t } from "../../../../../i18n/en";
import { nowHours, yearOf } from "../../../../../sim/00-core/time";
import { installerFile, programById, programRelease } from "../../../../../sim/10-catalog/programs";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { downloadProgram, installProgram } from "../../../../../sim/90-actions/programs";
import { usePageAct } from "../../pageAct";
import "./programs.css";

// filegorilla-project.org as the FileZilla project site looked: a plain page with the menu on the left.
export function ProgramSite({ game, id, path, go }: { game: GameState; id: string; path: string; go: (url: string) => void }) {
  const act = usePageAct(), p = programById(id);
  if (!p) return null;
  const year = yearOf(game.hour), { version, mb } = programRelease(p, year), d = game.installers[id], page = path.startsWith("/download") ? "download" : "home";
  const link = (to: string, label: string) => <a href={`#${to}`} className={page === (to || "home") ? "on" : undefined} onClick={(e) => { e.preventDefault(); go(`${displayHost(p.host)}/${to}`); }}>{label}</a>;
  const state = () => {
    if (game.installed.includes(id)) return <span className="pg-state">{t("programs.installed")}</span>;
    if (d && game.hour >= d.readyAt) return <button type="button" className="pg-btn" onClick={() => act(installProgram, id)}>{t("programs.install")}</button>;
    if (d) return <progress max={1} value={Math.min(1, (nowHours(game) - d.startedAt) / (d.readyAt - d.startedAt))} />;
    return <button type="button" className="pg-btn" onClick={() => act(downloadProgram, id)}>{t("programs.download", { name: id })}</button>;
  };
  return (
    <div className="pg" data-era={year < 2007 ? "old" : "new"}>
      <header><b>{id}</b><span>{t("programs.slogan")}</span></header>
      <div className="pg-body">
        <nav>{link("", t("programs.home"))}{link("download", t("programs.downloadMenu"))}</nav>
        <main>
          {page === "home" && <>
            <h1>{t("programs.welcome", { name: id })}</h1>
            <p>{t(year < 2007 ? "programs.intro2" : "programs.intro3", { name: id })}</p>
            <h2>{t("programs.news")}</h2>
            <p>{t("programs.released", { name: id, version })}</p>
          </>}
          {page === "download" && <>
            <h1>{t("programs.downloadTitle", { name: id })}</h1>
            <p>{t("programs.latest", { name: id, version })}</p>
            <table><tbody><tr><td>{installerFile(p, year)}</td><td className="num">{t("programs.size", { mb })}</td></tr></tbody></table>
            <p>{state()}</p>
          </>}
        </main>
      </div>
      <footer>{t("programs.footer", { year })}</footer>
    </div>
  );
}
