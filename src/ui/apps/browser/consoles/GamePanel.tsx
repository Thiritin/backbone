import { useState, type ReactNode } from "react";
import { LOCALE } from "../../../../i18n/lang";
import { t } from "../../../../i18n/en";
import { yearOf } from "../../../../sim/00-core/time";
import { GAME_TITLES, MODS, titleById } from "../../../../sim/10-catalog/games";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { POOL_SIZE, daemonOf, freePorts, nodeKeys } from "../../../../sim/60-infra/daemons";
import { gameCrashed, gameLog, gameOf, latestVersion, playersOf } from "../../../../sim/60-infra/games";
import { addAllocation, changeTitle, installMod, removeAllocation, removeMod, restartDaemon, restartGame, setAutoRestart, setGameVersion, setRestartSchedule, updateDaemon, updateGameVersion } from "../../../../sim/90-actions/games";
import { useStore } from "../../../store";

// What a game server row shows next to its name: the title and the players online out of its slots.
export interface GameRow { title: string; faded: boolean; players: { players: number; slots: number } | null; crashed: boolean; offline: boolean; ports: number[]; managed: boolean }

export function GameLine({ g }: { g?: GameRow }) {
  if (!g) return null;
  return <span className="cx-sub">{[g.title, g.players && t("games.players", g.players), g.faded && t("games.faded"), g.crashed && t("games.crashed"), g.offline && t("games.daemonOffline"), g.ports.length > 0 && t("games.ports", { ports: g.ports.join(", ") })].filter(Boolean).join(" · ")}</span>;
}

// How many of the listed servers play each title.
export function TitlesSummary({ rows }: { rows: { game?: GameRow }[] }) {
  const n = new Map<string, { title: string; count: number; faded: boolean }>();
  for (const { game: g } of rows) if (g) n.set(g.title, { title: g.title, faded: g.faded, count: (n.get(g.title)?.count ?? 0) + 1 });
  if (!n.size) return null;
  return <p className="cx-sub">{[...n.values()].map((x) => [t("games.titleCount", { title: x.title, count: x.count }), x.faded && t("games.faded")].filter(Boolean).join(" ")).join(" · ")}</p>;
}

// The sections each panel names in its own words; the ids pick the block that fills them.
type Section = "overview" | "settings" | "mods" | "schedule" | "monitor" | "players" | "ports" | "console";
const SECTIONS: Record<string, Section[]> = {
  tcadmen: ["overview", "settings", "mods", "schedule", "monitor", "players", "console"],
  multikraft: ["players", "settings", "mods", "schedule", "console"],
  pterodaktyl: ["settings", "mods", "schedule", "monitor", "ports", "console"],
};

const weekday = (d: number) => new Intl.DateTimeFormat(LOCALE, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + d)));

// What the player can do with one game server, laid out in the tabs of the panel that hosts it.
export function GameDetails({ game, serviceId, panel }: { game: GameState; serviceId: string; panel: string }) {
  const act = useStore((s) => s.act), g = gameOf(game, serviceId), list = SECTIONS[panel] ?? SECTIONS.tcadmen, [pick, setPick] = useState<Section>(list[0]);
  const title = g && titleById(g.title);
  if (!g || !title) return null;
  const latest = latestVersion(game, g), players = playersOf(game, serviceId), down = gameCrashed(game, serviceId), always = panel === "pterodaktyl";
  const chips = <T,>(options: [T, string][], on: T, run: (v: T) => void) => <div className="cx-tools">{options.map(([v, label]) => <button key={String(v)} className="cx-chip" aria-pressed={on === v} onClick={() => run(v)}>{label}</button>)}</div>;
  const body: Record<Section, ReactNode> = {
    overview: (
      <table className="cx-table cx-facts"><tbody>
        <tr><th>{t("games.game")}</th><td>{t(`games.title.${g.title}`)}</td></tr>
        <tr><th>{t("games.version")}</th><td className="num">{g.version + 1}</td></tr>
        <tr><th>{t("browser-consoles-2.status")}</th><td>{down ? t("games.crashed") : t("games.running")}</td></tr>
        {players && <tr><th>{t("games.playersLabel")}</th><td className="num">{players.players}/{players.slots}</td></tr>}
        <tr><th>{t("games.crashCount")}</th><td className="num">{g.crashes}</td></tr>
      </tbody></table>
    ),
    settings: (
      <>
        <div className="cx-tools">
          <label className="cx-field">{t("games.version")}
            <select value={g.version} onChange={(e) => act(setGameVersion, serviceId, Number(e.target.value))}>
              {Array.from({ length: latest + 1 }, (_, v) => <option key={v} value={v}>{v + 1}</option>)}
            </select>
          </label>
          {g.version < latest ? <button className="cx-btn primary" onClick={() => act(updateGameVersion, serviceId)}>{t("games.updateTo", { version: latest + 1 })}</button> : <span className="cx-note">{t("browser-consoles-2.upToDate")}</span>}
        </div>
        <h4 className="cx-h">{t("games.titles")}</h4>
        {chips(GAME_TITLES.filter((x) => x.id === g.title || (x.from <= yearOf(game.hour) && yearOf(game.hour) <= x.fade)).map((x) => [x.id, t(`games.title.${x.id}`)] as [string, string]), g.title, (id) => id !== g.title && act(changeTitle, serviceId, id))}
      </>
    ),
    mods: (
      <table className="cx-table">
        <tbody>
          {MODS.filter((m) => m.titles.includes(g.title)).map((m) => {
            const on = g.mods.includes(m.id);
            return (
              <tr key={m.id}>
                <td><b>{t(`games.mod.${m.id}`)}</b>{on && m.works < g.version && <span className="cx-sub">{t("games.broken")}</span>}</td>
                <td><button className="cx-btn" onClick={() => act(on ? removeMod : installMod, serviceId, m.id)}>{on ? t("games.remove") : t("games.install")}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ),
    schedule: (
      <>
        {chips((["off", "daily", "weekly"] as const).map((e) => [e, t(`browser-consoles-2.${e}`)] as [typeof e, string]), g.restart.every, (e) => act(setRestartSchedule, serviceId, e, g.restart.hour, g.restart.day))}
        {g.restart.every !== "off" && (
          <div className="cx-tools">
            <label className="cx-field">{t("games.hour")}
              <input type="number" min={0} max={23} value={g.restart.hour} onChange={(e) => act(setRestartSchedule, serviceId, g.restart.every, Number(e.target.value), g.restart.day)} />
            </label>
            {g.restart.every === "weekly" && (
              <label className="cx-field">{t("games.day")}
                <select value={g.restart.day} onChange={(e) => act(setRestartSchedule, serviceId, g.restart.every, g.restart.hour, Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{weekday(d)}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </>
    ),
    monitor: (
      <div className="cx-tools">
        {always
          ? <span className="cx-note">{t("games.autoRestart")}: {t("browser-consoles-2.on")}</span>
          : <button className="cx-chip" aria-pressed={g.auto} onClick={() => act(setAutoRestart, serviceId, !g.auto)}>{t("games.autoRestart")}: {g.auto ? t("browser-consoles-2.on") : t("browser-consoles-2.off")}</button>}
        {down && <button className="cx-btn primary" onClick={() => act(restartGame, serviceId)}>{t("games.restart")}</button>}
      </div>
    ),
    players: (
      <>
        <span className="cx-use num">{players ? t("games.players", players) : ""}</span>
        <div className="gp-hours" role="img" aria-label={t("games.last24")}>
          {Array.from({ length: 24 }, (_, h) => playersOf(game, serviceId, game.hour - 23 + h)).map((p, h) => <i key={h} style={{ height: `${p && p.slots ? (p.players / p.slots) * 100 : 0}%` }} />)}
        </div>
      </>
    ),
    console: (
      <pre className="gp-log">{gameLog(game, serviceId).map((l) => `${String(l.at % 24).padStart(2, "0")}:00 ${t(l.key, { ...l.params, mod: l.key === "games.log.mod" ? t(`games.mod.${l.params.mod}`) : "" })}`).join("\n")}</pre>
    ),
    ports: (
      <>
        <table className="cx-table">
          <thead><tr><th>{t("games.port")}</th><th /></tr></thead>
          <tbody>{g.ports.map((p) => <tr key={p}><td className="num">{p}</td><td><button className="cx-btn" onClick={() => act(removeAllocation, serviceId, p)}>{t("games.remove")}</button></td></tr>)}</tbody>
        </table>
        <div className="cx-tools"><button className="cx-btn" onClick={() => act(addAllocation, serviceId)}>{t("games.addAllocation")}</button></div>
      </>
    ),
  };
  return (
    <div className="gp">
      <div className="cx-tools">{list.map((x) => <button key={x} className="cx-chip" aria-pressed={pick === x} onClick={() => setPick(x)}>{t(`games.tab.${panel}.${x}`)}</button>)}</div>
      {body[list.includes(pick) ? pick : list[0]]}
    </div>
  );
}

// The Wings daemon and port pool of every node of a Pterodaktyl cluster.
export function GameNodes({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act);
  return (
    <table className="cx-table">
      <thead><tr><th>{t("browser-consoles-2.node")}</th><th>{t("games.daemon")}</th><th>{t("games.version")}</th><th>{t("games.allocations")}</th><th /></tr></thead>
      <tbody>
        {nodeKeys(c).map((key) => {
          const d = daemonOf(game, key), name = game.devices.find((x) => x.id === key)?.hostname ?? c.name, used = POOL_SIZE - freePorts(game, key).length;
          const behind = !!d && d.version < c.version;
          return (
            <tr key={key}>
              <td><b>{name}</b></td>
              <td><span className={`cx-state ${d?.state === "online" ? "ok" : "bad"}`}>{d?.state === "offline" ? t("games.daemonOffline") : t("games.daemonOnline")}</span></td>
              <td className="num">{d?.version ?? ""}</td>
              <td className="num">{`${used}/${POOL_SIZE}`}</td>
              <td>
                <button className="cx-btn" onClick={() => act(restartDaemon, key)}>{t("games.restartDaemon")}</button>
                {behind && <button className="cx-btn primary" onClick={() => act(updateDaemon, key)}>{t("games.updateDaemon")}</button>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
