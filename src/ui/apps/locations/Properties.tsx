import { Building2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { DEPOSIT_MONTHS, listingsIn, NOTICE_MONTHS, priceFor, REFIT, rentFor, sectionIds, takenSections, type Listing } from "../../../sim/20-world/properties";
import type { GameState, SectionFit } from "../../../sim/50-state";
import { addressLine } from "../../../sim/60-infra/properties";
import { noticeEnd } from "../../../sim/90-actions/hardware";
import { buyBuilding, freeSections, giveNotice, refitSection, rentSection } from "../../../sim/90-actions/properties";
import { useStore } from "../../store";
import { day } from "../hw";
import { Facts } from "./ui";

export function Properties({ game }: { game: GameState }) {
  const year = yearOf(game.hour), city = game.locations[0]?.city ?? "Frankfurt";
  return (
    <div className="loc-scroll">
      <div className="loc-cards">
        {listingsIn(city, year).map((l) => <BuildingCard key={l.id} game={game} l={l} year={year} />)}
      </div>
    </div>
  );
}

function BuildingCard({ game, l, year }: { game: GameState; l: Listing; year: number }) {
  const act = useStore((s) => s.act);
  const [sel, setSel] = useState<string | null>(null);
  const mine = game.properties.find((p) => p.buildingId === l.id), taken = takenSections(game.seed, l), free = freeSections(game, l);
  const rent = rentFor(l, year), price = priceFor(l, year), ids = sectionIds(l);
  const own = mine?.sections.find((x) => x.id === sel), canRent = sel !== null && free.includes(sel) && mine?.kind !== "own";
  const floors = [...new Set(ids.map((x) => x.floor))].reverse();
  const cell = (id: string) => {
    const x = mine?.sections.find((k) => k.id === id);
    if (x) return { cls: "mine", label: x.refitUntil > game.hour ? t("properties.refitUntil", { date: day(x.refitUntil) }) : x.fit ? t(`properties.state.${x.fit}`) : t("properties.state.empty") };
    return taken.has(id) ? { cls: "taken", label: t("properties.state.taken") } : { cls: "free", label: t("properties.state.free") };
  };
  const refit = (fit: SectionFit) => own && own.fit !== fit && (
    <button className="btn" disabled={own.refitUntil > game.hour} onClick={() => act(refitSection, mine!.id, own.id, fit)}>
      {t(`properties.refit${fit[0].toUpperCase()}${fit.slice(1)}`, { cost: euro(REFIT[fit].cost) })}
    </button>
  );
  return (
    <div className="loc-card">
      <div className="loc-card-h">
        <h3><Building2 />{l.name}</h3><span className="grow" />
        {mine && <span className="loc-chip">{t(`properties.kind.${mine.kind}`)}</span>}
      </div>
      <Facts rows={[
        [t("properties.address"), addressLine(l)],
        [t("properties.freeSections"), <span className="num">{`${free.length} / ${ids.length}`}</span>],
        [t("properties.rentPerSection"), <span className="num">{t("locations-2.perMonth", { amount: euro(rent) })}</span>],
        ...(price !== null && mine?.kind !== "own" ? [[t("properties.buyPrice"), <span className="num">{euro(price)}</span>] as [string, ReactNode]] : []),
        ...(mine?.noticeAt != null ? [[t("properties.leaseEnds"), day(noticeEnd(mine.noticeAt, NOTICE_MONTHS))] as [string, ReactNode]] : []),
      ]} />
      <div className="prop-plan" role="grid">
        {floors.map((f) => (
          <div key={f} className="prop-floor" role="row">
            <span className="loc-k">{t("properties.floor", { n: f })}</span>
            {ids.filter((x) => x.floor === f).map(({ id }) => {
              const c = cell(id), pickable = c.cls !== "taken";
              return (
                <button key={id} role="gridcell" className={`prop-sec ${c.cls}`} aria-pressed={sel === id} disabled={!pickable} onClick={() => setSel(sel === id ? null : id)}
                  aria-label={`${t("properties.section", { id })}, ${c.label}`}>
                  <span className="num">{id}</span><small>{c.label}</small>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="loc-row prop-actions">
        {canRent && (
          <button className="btn primary" onClick={() => act(rentSection, l.id, sel!).ok && setSel(null)}>
            {t(mine ? "properties.expand" : "properties.rent", { cost: euro(rent * DEPOSIT_MONTHS) })}
          </button>
        )}
        {refit("desks")}{refit("closet")}{refit("servers")}
        <span className="grow" />
        {mine?.kind === "office" && mine.noticeAt === null && <button className="btn" onClick={() => act(giveNotice, mine.id)}>{t("properties.notice")}</button>}
        {price !== null && mine?.kind !== "own" && <button className="btn" onClick={() => act(buyBuilding, l.id)}>{t("properties.buy", { cost: euro(price) })}</button>}
      </div>
    </div>
  );
}
