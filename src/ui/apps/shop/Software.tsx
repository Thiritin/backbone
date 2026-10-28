import { BellDot, CalendarDays, ChartLine, Check, ChevronLeft, LifeBuoy, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { needsResearch, storeItem, subscriptionPrice, type StoreItem } from "../../../sim/10-catalog/store";
import { cancel, install } from "../../../sim/90-actions/store";
import { PearMark } from "../../desktop/Intro";
import { appByName } from "../registry";
import { useStore } from "../../store";

const UPGRADES: Record<string, { icon: LucideIcon; tile: string; about: string }> = {
  dockBadges: { icon: BellDot, tile: "oklch(0.6 0.2 25)", about: "Shows a count on each dock app of what waits for you." },
  widgetCalendar: { icon: CalendarDays, tile: "oklch(0.6 0.2 25)", about: "Shows today's date on your desktop." },
  widgetTickets: { icon: LifeBuoy, tile: "oklch(0.62 0.19 35)", about: "Shows your open tickets on your desktop." },
  widgetCash: { icon: Wallet, tile: "oklch(0.55 0.13 175)", about: "Shows your cash on your desktop." },
  widgetRevenue: { icon: ChartLine, tile: "oklch(0.55 0.13 175)", about: "Shows your monthly revenue on your desktop." },
  widgetCustomers: { icon: Users, tile: "oklch(0.52 0.17 268)", about: "Shows your customer count on your desktop." },
  widgetLevel: { icon: Trophy, tile: "oklch(0.72 0.15 95)", about: "Shows your company level and the way to the next one on your desktop." },
};

const INCLUDES: Record<string, string[]> = {
  Network: ["Transit and peering", "DDoS protection", "Topology view"],
  Products: ["Product lines and plans", "Software licences", "Clusters"],
  Staff: ["Job market", "Hiring and salaries", "Task assignment"],
  Marketing: ["Campaigns", "Reviews", "Review platforms"],
  Market: ["Demand by product", "Customer requirements", "Lost-sale reports"],
  dockBadges: ["Open tickets in Support", "Unpaid invoices in Billing", "Failed parts in Locations"],
  widgetCalendar: ["Weekday, date and year"],
  widgetTickets: ["Open ticket count", "Opens Support"],
  widgetCash: ["Cash balance", "Opens Finance"],
  widgetRevenue: ["Monthly recurring revenue", "Opens Finance"],
  widgetCustomers: ["Customer count", "Opens Customers"],
  widgetLevel: ["Company level", "Progress to the next level", "Opens Finance"],
};

const SHELVES: [string, string[]][] = [
  ["Essentials", ["Network", "Products"]],
  ["Growth", ["Staff", "Marketing", "Market"]],
  ["Upgrades", ["dockBadges", "widgetCalendar", "widgetTickets", "widgetCash", "widgetRevenue", "widgetCustomers", "widgetLevel"]],
];

export const artOf = (item: StoreItem) => (item.kind === "app" ? appByName(item.id) : UPGRADES[item.id]);

export function Tile({ item, size }: { item: StoreItem; size: number }) {
  const art = artOf(item);
  return <span className="ps-tile" style={{ "--tile": art.tile, "--size": `${size}px` } as CSSProperties}><art.icon /></span>;
}

function Action({ item, big }: { item: StoreItem; big?: boolean }) {
  const { game, act, openApp } = useStore();
  const cls = `ps-get${big ? " big" : ""}`;
  if (needsResearch(item, game.unlocks)) return <button className={cls} onClick={(e) => { e.stopPropagation(); openApp("Unlocks"); }}>Research</button>;
  if (!game.installed.includes(item.id)) return <button className={`${cls} primary`} onClick={(e) => { e.stopPropagation(); act((s) => install(s, item.id)); }}>Get</button>;
  if (item.kind === "upgrade") return <span className="ps-owned"><Check />Installed</span>;
  return <button className={cls} onClick={(e) => { e.stopPropagation(); openApp(item.id); }}>Open</button>;
}

export function Software() {
  const game = useStore((s) => s.game);
  const [open, setOpen] = useState<string | null>(null);
  const price = (item: StoreItem) => `${euroCents(subscriptionPrice(item, yearOf(game.hour)))} / month`;
  const detail = open && storeItem(open);
  if (detail) return <Detail item={detail} price={price(detail)} back={() => setOpen(null)} />;

  const featured = storeItem(SHELVES.flatMap(([, ids]) => ids).find((id) => !game.installed.includes(id)) ?? "Network")!;
  return (
    <div className="ps">
      <section className="ps-hero">
        <div className="ps-hero-copy">
          <span className="ps-brand"><PearMark />Pear Store</span>
          <h2>Unlock the future today.</h2>
          <p>Great upgrades to your operating system that make your life easier.</p>
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
          <h3>{title}</h3>
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
  const facts: [string, string][] = [
    ["Subscription", price],
    ["Research", item.knowHow ? `${item.knowHow} know-how` : "None"],
    ["Status", has ? "Installed" : needsResearch(item, game.unlocks) ? "Not researched" : "Available"],
  ];
  return (
    <div className="ps">
      <button className="btn ghost ps-back" onClick={back}><ChevronLeft />Software</button>
      <header className="ps-detail-head">
        <Tile item={item} size={112} />
        <div>
          <h2>{item.name}</h2>
          <p>{artOf(item).about}</p>
          <div className="ps-detail-actions">
            <Action item={item} big />
            {has && <button className="btn" onClick={() => act((s) => cancel(s, item.id))}>Cancel subscription</button>}
          </div>
        </div>
      </header>
      <dl className="ps-facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === "Status" ? undefined : "num"}>{v}</dd></div>)}
      </dl>
      <section className="ps-shelf">
        <h3>Includes</h3>
        <ul className="ps-includes">{INCLUDES[item.id].map((f) => <li key={f}><Check />{f}</li>)}</ul>
      </section>
    </div>
  );
}
