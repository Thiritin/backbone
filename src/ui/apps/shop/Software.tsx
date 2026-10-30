import { Bot, Search, CalendarDays, Paperclip, ChartLine, Check, ChevronLeft, LifeBuoy, Trophy, Users, Wallet, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useSessionState } from "../../session";
import { euroCents } from "../../../sim/00-core/money";
import { pricePerMTokens } from "../../../sim/47-staff/chad";
import { yearOf } from "../../../sim/00-core/time";
import { isAvailable, skillFor } from "../../../sim/10-catalog/research";
import { deskById, deskReady, seats, type DeskFeature } from "../../../sim/10-catalog/desks";
import { storeItem, subscriptionPrice, type StoreItem } from "../../../sim/10-catalog/store";
import { cancel, install } from "../../../sim/90-actions/store";
import { Confirm } from "../../desktop/Confirm";
import { PearMark } from "../../desktop/Intro";
import { appByName } from "../registry";
import { DESK } from "../support/desk";
import { useStore } from "../../store";

const UPGRADES: Record<string, { icon: LucideIcon; tile: string; about: string }> = {
  searchlight: { icon: Search, tile: "oklch(0.55 0.16 255)", about: "Finds apps, customers, machines, tickets and sites from one field." },
  widgetCalendar: { icon: CalendarDays, tile: "oklch(0.6 0.2 25)", about: "Shows today's date on your desktop." },
  widgetTickets: { icon: LifeBuoy, tile: "oklch(0.62 0.19 35)", about: "Shows your open tickets on your desktop." },
  widgetCash: { icon: Wallet, tile: "oklch(0.55 0.13 175)", about: "Shows your cash on your desktop." },
  widgetRevenue: { icon: ChartLine, tile: "oklch(0.55 0.13 175)", about: "Shows your monthly revenue on your desktop." },
  widgetCustomers: { icon: Users, tile: "oklch(0.52 0.17 268)", about: "Shows your customer count on your desktop." },
  widgetLevel: { icon: Trophy, tile: "oklch(0.72 0.15 95)", about: "Shows your company level and the way to the next one on your desktop." },
  chadGpt: { icon: Bot, tile: "oklch(0.55 0.16 300)", about: "Answers how-to and billing tickets day and night, with confidence." },
  clipsy: { icon: Paperclip, tile: "oklch(0.6 0.14 220)", about: "Sends payment reminders day and night, with enthusiasm." },
};

const FEATURE: Record<DeskFeature, string> = {
  filters: "Filter by kind", search: "Search", assign: "Assign to agents", templates: "Reply templates", slaTimers: "Response timers", customerSidebar: "Customer sidebar", reports: "Reports",
};
const DESK_ABOUT: Record<string, string> = {
  ostickit: "Groups tickets by kind in plain grey tables, free and open source since 2005.",
  zendusk: "Adds search, assignment, reply templates, response timers, a customer sidebar and reports.",
  freshdusk: "Adds search, assignment, reply templates and response timers on teal cards.",
  freescoot: "Adds search and assignment to a free, light list.",
};

const INCLUDES: Record<string, string[]> = {
  Network: ["Transit and peering", "DDoS protection", "Topology view"],
  Staff: ["Job market", "Hiring and salaries", "Task assignment"],
  Marketing: ["Campaigns", "Reviews", "Review platforms"],
  Nagiosaurus: ["Versions of installed software", "Open vulnerabilities by severity", "Days exposed"],
  "Knowledge base": ["Articles for basic setup questions", "Fewer how-to tickets", "Reads per article"],
  Market: ["Demand by product", "Customer requirements", "Lost-sale reports"],
  searchlight: ["Opens with Ctrl+K or Cmd+K", "Apps, customers and machines", "Tickets, sites and settings"],
  widgetCalendar: ["Weekday, date and year"],
  widgetTickets: ["Open ticket count", "Opens Support"],
  widgetCash: ["Cash balance", "Opens Finance"],
  widgetRevenue: ["Monthly recurring revenue", "Opens Finance"],
  widgetCustomers: ["Customer count", "Opens Customers"],
  widgetLevel: ["Company level", "Progress to the next level", "Opens Finance"],
  chadGpt: ["How-to tickets", "Billing tickets", "Works around the clock"],
  clipsy: ["Payment reminders", "Works around the clock"],
};

const SHELVES: [string, string[]][] = [
  ["Essentials", ["Network", "Nagiosaurus", "Knowledge base"]],
  ["Growth", ["Staff", "Marketing", "Market"]],
  ["Bots", ["chadGpt", "clipsy"]],
  ["Support desks", ["ostickit", "zendusk", "freshdusk", "freescoot"]],
  ["Upgrades", ["searchlight", "widgetCalendar", "widgetTickets", "widgetCash", "widgetRevenue", "widgetCustomers", "widgetLevel"]],
];

export const artOf = (item: StoreItem) => (item.kind === "app" ? appByName(item.id) : item.kind === "desk" ? { icon: DESK[item.id].icon, tile: DESK[item.id].tile, about: DESK_ABOUT[item.id] } : UPGRADES[item.id]);

export function Tile({ item, size }: { item: StoreItem; size: number }) {
  const art = artOf(item);
  return <span className="ps-tile" style={{ "--tile": art.tile, "--size": `${size}px` } as CSSProperties}><art.icon /></span>;
}

function Action({ item, big }: { item: StoreItem; big?: boolean }) {
  const { game, act, openApp } = useStore();
  const cls = `ps-get${big ? " big" : ""}`;
  const skill = skillFor(item.id);
  if (skill && !isAvailable(item.id, game.unlocks)) return <button className={cls} onClick={(e) => { e.stopPropagation(); openApp("Research", { kind: "skill", id: skill.id }); }}>Needs {skill.name}</button>;
  if (item.kind === "desk" && !game.installed.includes(item.id) && !deskReady(game, item.id)) return <button className={cls} disabled>From {deskById(item.id)!.from}</button>;
  if (!game.installed.includes(item.id)) return <button className={`${cls} primary`} onClick={(e) => { e.stopPropagation(); act(install, item.id); }}>Get</button>;
  if (item.kind !== "app") return <span className="ps-owned"><Check />Installed</span>;
  return <button className={cls} onClick={(e) => { e.stopPropagation(); openApp(item.id === "Nagiosaurus" ? "Security" : item.id); }}>Open</button>;
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
  const price = (item: StoreItem) => (item.monthly ? `${euroCents(subscriptionPrice(item, yearOf(game.hour)))} / month${item.perSeat ? " per seat" : ""}${item.id === "chadGpt" ? ` + ${euroCents(pricePerMTokens(yearOf(game.hour)))} / 1M tokens` : ""}` : "Free");
  const detail = open && storeItem(open);
  if (detail) return <Detail item={detail} price={price(detail)} back={() => setOpen(null)} />;

  const featured = storeItem(featuredId(game.installed, game.unlocks))!;
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
  const [cancelling, setCancelling] = useState(false);
  const facts: [string, string][] = [
    ["Subscription", price],
    ...(item.perSeat ? [["Seats", String(seats(game))] as [string, string]] : []),
    ["Skill", skillFor(item.id)?.name ?? "None"],
    ["Status", has ? "Installed" : item.kind === "desk" && !deskReady(game, item.id) ? "Not on sale yet" : !isAvailable(item.id, game.unlocks) ? "Not learned" : "Available"],
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
            {has && <button className="btn" onClick={() => setCancelling(true)}>Cancel subscription</button>}
          </div>
        </div>
      </header>
      <dl className="ps-facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === "Subscription" ? "num" : undefined}>{v}</dd></div>)}
        {cancelling && <Confirm title={`Cancel ${item.name}?`} action="Cancel subscription" onCancel={() => setCancelling(false)}
          onConfirm={() => { setCancelling(false); act(cancel, item.id); }} text={`The subscription for ${item.name} ends today.`} />}
      </dl>
      <section className="ps-shelf">
        <h3>Includes</h3>
        <ul className="ps-includes">{(item.kind === "desk" ? deskById(item.id)!.features.map((f) => FEATURE[f]) : INCLUDES[item.id]).map((f) => <li key={f}><Check />{f}</li>)}</ul>
      </section>
    </div>
  );
}
