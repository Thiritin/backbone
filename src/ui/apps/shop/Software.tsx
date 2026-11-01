import { Bot, KeyRound, Search, CalendarDays, Paperclip, ChartLine, Check, ChevronLeft, LifeBuoy, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useSessionState } from "../../session";
import { euroCents } from "../../../sim/00-core/money";
import { pricePerMTokens } from "../../../sim/47-staff/chad";
import { yearOf } from "../../../sim/00-core/time";
import { isAvailable, skillFor } from "../../../sim/10-catalog/research";
import { deskById, deskReady, seats } from "../../../sim/10-catalog/desks";
import { storeItem, subscriptionPrice, type StoreItem } from "../../../sim/10-catalog/store";
import { cancel, install } from "../../../sim/90-actions/store";
import { Confirm } from "../../desktop/Confirm";
import { PearMark } from "../../desktop/Intro";
import { appByName } from "../registry";
import { DESK } from "../support/desk";
import { rowLabel } from "./filter";
import { useStore } from "../../store";
import { t } from "../../../i18n/en";

const UPGRADES: Record<string, { icon: LucideIcon; tile: string }> = {
  searchlight: { icon: Search, tile: "oklch(0.55 0.16 255)" },
  keepassive: { icon: KeyRound, tile: "oklch(0.5 0.12 150)" },
  widgetCalendar: { icon: CalendarDays, tile: "oklch(0.6 0.2 25)" },
  widgetTickets: { icon: LifeBuoy, tile: "oklch(0.62 0.19 35)" },
  widgetCash: { icon: Wallet, tile: "oklch(0.55 0.13 175)" },
  widgetRevenue: { icon: ChartLine, tile: "oklch(0.55 0.13 175)" },
  widgetCustomers: { icon: Users, tile: "oklch(0.52 0.17 268)" },
  widgetLevel: { icon: Trophy, tile: "oklch(0.72 0.15 95)" },
  chadGpt: { icon: Bot, tile: "oklch(0.55 0.16 300)" },
  clipsy: { icon: Paperclip, tile: "oklch(0.6 0.14 220)" },
};

const INCLUDES: Record<string, number> = {
  Network: 3, Staff: 3, Marketing: 3, Nagiosaurus: 3, "Knowledge base": 3, Market: 3, searchlight: 3, keepassive: 3, widgetCalendar: 1, widgetTickets: 2, widgetCash: 2, widgetRevenue: 2, widgetCustomers: 2, widgetLevel: 3, chadGpt: 3, clipsy: 2,
};

const SHELVES: [string, string[]][] = [
  ["Essentials", ["Network", "Nagiosaurus", "Knowledge base"]],
  ["Growth", ["Staff", "Marketing", "Market"]],
  ["Bots", ["chadGpt", "clipsy"]],
  ["Support desks", ["ostickit", "zendusk", "freshdusk", "freescoot"]],
  ["Upgrades", ["searchlight", "keepassive", "widgetCalendar", "widgetTickets", "widgetCash", "widgetRevenue", "widgetCustomers", "widgetLevel"]],
];

export const artOf = (item: StoreItem) => (item.kind === "app" ? appByName(item.id) : item.kind === "desk" ? { icon: DESK[item.id].icon, tile: DESK[item.id].tile, about: t(`shop.deskAbout.${item.id}`) } : { ...UPGRADES[item.id], about: t(`shop.upgrade.${item.id}`) });

export function Tile({ item, size }: { item: StoreItem; size: number }) {
  const art = artOf(item);
  return <span className="ps-tile" style={{ "--tile": art.tile, "--size": `${size}px` } as CSSProperties}><art.icon /></span>;
}

function Action({ item, big }: { item: StoreItem; big?: boolean }) {
  const { game, act, openApp } = useStore();
  const cls = `ps-get${big ? " big" : ""}`;
  const skill = skillFor(item.id);
  if (skill && !isAvailable(item.id, game.unlocks)) return <button className={cls} onClick={(e) => { e.stopPropagation(); openApp("Research", { kind: "skill", id: skill.id }); }}>{t("shop.needs", { skill: skill.name })}</button>;
  if (item.kind === "desk" && !game.installed.includes(item.id) && !deskReady(game, item.id)) return <button className={cls} disabled>{t("shop.from", { from: deskById(item.id)!.from })}</button>;
  if (!game.installed.includes(item.id)) return <button className={`${cls} primary`} onClick={(e) => { e.stopPropagation(); act(install, item.id); }}>{t("shop.get")}</button>;
  if (item.kind !== "app") return <span className="ps-owned"><Check />{t("shop.installed")}</span>;
  return <button className={cls} onClick={(e) => { e.stopPropagation(); openApp(item.id === "Nagiosaurus" ? "Security" : item.id); }}>{t("shop.open")}</button>;
}

// The app unlocked most recently that is not installed yet; then any item on the shelves.
function featuredId(installed: string[], learned: string[]): string {
  const open = SHELVES.flatMap(([, ids]) => ids).filter((id) => !installed.includes(id));
  const rank = (id: string) => { const k = skillFor(id); return k ? learned.indexOf(k.id) : -0.5; };
  const ready = open.filter((id) => storeItem(id)?.kind === "app" && isAvailable(id, learned)).sort((a, b) => rank(b) - rank(a));
  return ready[0] ?? open[0] ?? "Network";
}

export function Software() {
  const game = useStore((s) => s.game);
  const [open, setOpen] = useSessionState<string | null>("software.sel", null);
  const price = (item: StoreItem) => (item.monthly ? `${t("shop.priceMonthly", { price: euroCents(subscriptionPrice(item, yearOf(game.hour))), seat: item.perSeat ? 1 : 0 })}${item.id === "chadGpt" ? ` + ${t("shop.priceTokens", { price: euroCents(pricePerMTokens(yearOf(game.hour))) })}` : ""}` : t("shop.free"));
  const detail = open && storeItem(open);
  if (detail) return <Detail item={detail} price={price(detail)} back={() => setOpen(null)} />;

  const featured = storeItem(featuredId(game.installed, game.unlocks))!;
  return (
    <div className="ps">
      <section className="ps-hero">
        <div className="ps-hero-copy">
          <span className="ps-brand"><PearMark />Pear Store</span>
          <h2>{t("shop.heroTitle")}</h2>
          <p>{t("shop.heroText")}</p>
        </div>
        <div className="ps-feature" role="button" tabIndex={0} onClick={() => setOpen(featured.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(featured.id)}>
          <Tile item={featured} size={88} />
          <span className="ps-feature-name">{featured.name}</span>
          <span className="ps-feature-sub">{artOf(featured).about}</span>
          <Action item={featured} />
        </div>
      </section>
      {SHELVES.map(([title, ids]) => (
        <section key={title} className="ps-shelf">
          <h3>{t(`shop.shelf.${title}`)}</h3>
          <div className="ps-rows">
            {ids.map((id) => {
              const item = storeItem(id)!;
              return (
                <div key={id} className="ps-row" role="button" tabIndex={0} onClick={() => setOpen(id)} onKeyDown={(e) => e.key === "Enter" && setOpen(id)}>
                  <Tile item={item} size={52} />
                  <span className="ps-row-text">
                    <strong>{item.name}</strong>
                    <span>{artOf(item).about}</span>
                    <span className="num">{price(item)}</span>
                  </span>
                  <Action item={item} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Detail({ item, price, back }: { item: StoreItem; price: string; back: () => void }) {
  const { game, act } = useStore();
  const has = game.installed.includes(item.id);
  const [cancelling, setCancelling] = useState(false);
  const facts: [string, string][] = [
    ["Subscription", price],
    ...(item.perSeat ? [["Seats", String(seats(game))] as [string, string]] : []),
    ["Skill", skillFor(item.id)?.name ?? t("shop.skillNone")],
    ["Status", has ? t("shop.installed") : item.kind === "desk" && !deskReady(game, item.id) ? t("shop.status.notOnSale") : !isAvailable(item.id, game.unlocks) ? t("shop.status.notLearned") : t("shop.status.available")],
  ];
  return (
    <div className="ps">
      <button className="btn ghost ps-back" onClick={back}><ChevronLeft />{t("shop.software")}</button>
      <header className="ps-detail-head">
        <Tile item={item} size={112} />
        <div>
          <h2>{item.name}</h2>
          <p>{artOf(item).about}</p>
          <div className="ps-detail-actions">
            <Action item={item} big />
            {has && <button className="btn" onClick={() => setCancelling(true)}>{t("shop.cancelSubscription")}</button>}
          </div>
        </div>
      </header>
      <dl className="ps-facts">
        {facts.map(([k, v]) => <div key={k}><dt>{rowLabel(k)}</dt><dd className={k === "Subscription" ? "num" : undefined}>{v}</dd></div>)}
        {cancelling && <Confirm title={t("shop.cancelTitle", { name: item.name })} action={t("shop.cancelSubscription")} onCancel={() => setCancelling(false)}
          onConfirm={() => { setCancelling(false); act(cancel, item.id); }} text={t("shop.cancelText", { name: item.name })} />}
      </dl>
      <section className="ps-shelf">
        <h3>{t("shop.includes")}</h3>
        <ul className="ps-includes">{(item.kind === "desk" ? deskById(item.id)!.features.map((f) => t(`shop.feature.${f}`)) : Array.from({ length: INCLUDES[item.id] }, (_, i) => t(`shop.inc.${item.id}.${i}`))).map((f) => <li key={f}><Check />{f}</li>)}</ul>
      </section>
    </div>
  );
}
