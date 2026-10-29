import { Handshake, House, Landmark, Server, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import {
  carrierById, carriersAt, COMMITS, dcPerTb, EXCHANGE_FEES, exchangeAt, exchangeById, exchangePortPrice, FIBER_GBIT, PEERS, PROTECTIONS, speedsIn,
  transitPerMbps, zoneLinkPrice, ASN_FEE, type Peer, type Protection, type ZoneLinkKind,
} from "../../../sim/10-catalog/network";
import { datacenterById, homeLineById, inUs } from "../../../sim/20-world/datacenters";
import type { GameState, Location } from "../../../sim/50-state";
import {
  acceptChance, activeExchanges, capacityMbps, coolingDown, crossConnects, homePeak, monthlyNetworkCost, p95, route, transitBill, zoneLinkMonthly, type Uplink,
} from "../../../sim/60-infra/network";
import {
  acceptPeering, addUplinkLink, cancelUplink, cancelZoneLink, joinExchange, orderExchangePort, orderTransit, orderZoneLink, registerAsn, rejectPeering,
  requestPeering, setBlackhole, setProtection,
} from "../../../sim/90-actions/network";
import { cityNamed, WorldMap, type Marker } from "../../map/WorldMap";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import { AddressList, Ripe } from "./Addresses";
import { Topology } from "./Topology";
import "../shop/shop.css";
import "../billing/billing.css";
import "../marketing/marketing.css";
import "./network.css";

export const mbps = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} Gbit/s` : `${v >= 10 ? Math.round(v) : v.toFixed(v >= 1 ? 1 : 2)} Mbit/s`);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const partnerName = (u: Uplink) => carrierById(u.partner)?.name ?? exchangeById(u.partner)?.name ?? u.partner;
export const loadClass = (load: number) => (load >= 0.9 ? "bad" : load >= 0.6 ? "warn" : "ok");

type Page = { kind: "zone"; id: string } | { kind: "peering" } | { kind: "ddos" } | { kind: "ripe" };

export function NetworkApp() {
  const game = useStore((s) => s.game);
  const [page, setPage] = useState<Page>({ kind: "zone", id: game.locations[0].id });
  const routing = useMemo(() => route(game), [game]);
  const now = Object.values(routing.zones).reduce((n, z) => n + z.carried, 0);
  const dropped = Object.values(routing.zones).reduce((n, z) => n + z.dropped, 0);
  const zone = page.kind === "zone" ? game.locations.find((l) => l.id === page.id) ?? game.locations[0] : null;
  const item = (key: string, active: boolean, icon: ReactNode, label: string, count: number | null, go: () => void) => (
    <button key={key} className={`side-item${active ? " active" : ""}`} aria-pressed={active} onClick={go}>
      {icon}{label}{count ? <span className="side-count">{count}</span> : null}
    </button>
  );

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Sections">
        <div className="side-h">Zones</div>
        {game.locations.map((l) => item(l.id, zone?.id === l.id, l.dc ? <Server /> : <House />, `${l.az} ${l.name}`, game.network.saturated.includes(l.id) ? 1 : null,
          () => setPage({ kind: "zone", id: l.id })))}
        <div className="side-h">Network</div>
        {item("peering", page.kind === "peering", <Handshake />, "Peering", game.network.requests.length, () => setPage({ kind: "peering" }))}
        {item("ddos", page.kind === "ddos", <ShieldAlert />, "DDoS", game.network.attacks.length, () => setPage({ kind: "ddos" }))}
        {item("ripe", page.kind === "ripe", <Landmark />, "RIPE", null, () => setPage({ kind: "ripe" }))}
      </nav>
      <div className="fin-main">
        <dl className="fin-totals">
          <div><dt>Network per month</dt><dd className="num">{euro(monthlyNetworkCost(game))}</dd></div>
          <div><dt>Traffic now</dt><dd className="num">{mbps(now)}</dd></div>
          <div><dt>Dropped now</dt><dd className={`num${dropped > 0 ? " net-bad" : ""}`}>{mbps(dropped)}</dd></div>
          <div><dt>AS number</dt><dd className="num">{game.network.asn ? `AS${game.network.asn}` : "None"}</dd></div>
        </dl>
        <div className="fin-scroll">
          {zone && <ZonePage key={zone.id} game={game} loc={zone} routing={routing} />}
          {page.kind === "peering" && <Peering game={game} />}
          {page.kind === "ddos" && <Ddos game={game} />}
          {page.kind === "ripe" && <Ripe game={game} />}
        </div>
      </div>
    </div>
  );
}

type View = "uplinks" | "addresses" | "topology" | "map";

function ZonePage({ game, loc, routing }: { game: GameState; loc: Location; routing: ReturnType<typeof route> }) {
  const [view, setView] = useState<View>("uplinks");
  const z = routing.zones[loc.id];
  return (
    <>
      <div className="net-head">
        <h2>{loc.az} {loc.name}</h2>
        <span className="num net-now">{mbps(z?.carried ?? 0)} of {mbps(z?.demand ?? 0)}</span>
        <span className="grow" />
        <div className="seg" role="group" aria-label="View">
          {(["uplinks", "addresses", "topology", "map"] as View[]).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
      </div>
      <TrafficChart points={game.network.history[loc.id] ?? []} />
      {view === "uplinks" && <Uplinks game={game} loc={loc} routing={routing} />}
      {view === "addresses" && <AddressList game={game} loc={loc} />}
      {view === "topology" && <Topology game={game} loc={loc} routing={routing} />}
      {view === "map" && <NetworkMap game={game} />}
    </>
  );
}

// The last week: what the zone wanted to send as a line, what got through as an area.
function TrafficChart({ points }: { points: [number, number][] }) {
  const W = 720, H = 120, max = Math.max(1, ...points.map((p) => p[0]));
  const x = (i: number) => (points.length > 1 ? (i / (points.length - 1)) * W : 0), y = (v: number) => H - (v / max) * (H - 8);
  const line = (k: 0 | 1) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  return (
    <figure className="net-chart" aria-label="Traffic over the last week">
      <div className="net-legend"><span className="net-key carried" />Carried<span className="net-key demand" />Demand<span className="grow" /><span className="num">Peak {mbps(max)}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <line x1="0" x2={W} y1={y(max)} y2={y(max)} className="net-grid" />
        <line x1="0" x2={W} y1={y(max / 2)} y2={y(max / 2)} className="net-grid" />
        {points.length > 1 && <>
          <path d={`${line(1)}L${W},${H}L0,${H}Z`} className="net-area" />
          <path d={line(1)} className="net-carried" />
          <path d={line(0)} className="net-demand" />
        </>}
      </svg>
    </figure>
  );
}

function Uplinks({ game, loc, routing }: { game: GameState; loc: Location; routing: ReturnType<typeof route> }) {
  const used = routing.zones[loc.id]?.exits ?? {};
  const uplinks = game.network.uplinks.filter((u) => u.locationId === loc.id);
  const year = yearOf(game.hour);
  if (!loc.dc) {
    const line = homeLineById(game.homeLine.id);
    return (
      <div className="shop-grid mkt-flat">
        <div className="shop-card">
          <div className="mkt-head"><strong>{line.isp} {line.name}</strong><span className="pill">Home line</span></div>
          <dl className="shop-specs">
            <div><dt>Upload</dt><dd className="num">{mbps(line.up)}</dd></div>
            <div><dt>In use</dt><dd className="num">{mbps(used.home ?? 0)}</dd></div>
            <div><dt>Peak, 7 days</dt><dd className="num">{mbps(homePeak(game))}</dd></div>
          </dl>
          <Meter load={homePeak(game) / line.up} />
        </div>
      </div>
    );
  }
  const dc = datacenterById(loc.dc);
  return (
    <>
      <div className="shop-grid mkt-flat">
        <div className="shop-card">
          <div className="mkt-head"><strong>{dc.name}</strong><span className="pill">Bandwidth</span></div>
          <dl className="shop-specs">
            <div><dt>Capacity</dt><dd className="num">1 Gbit/s</dd></div>
            <div><dt>In use</dt><dd className="num">{mbps(used[`dc:${loc.id}`] ?? 0)}</dd></div>
            <div><dt>Price</dt><dd className="num">{euroCents(dcPerTb(year))} / TB</dd></div>
            <div><dt>This month</dt><dd className="num">{(game.network.dcTb[loc.id] ?? 0).toFixed(2)} TB</dd></div>
          </dl>
          <Meter load={(used[`dc:${loc.id}`] ?? 0) / 1000} />
        </div>
        {uplinks.map((u) => <UplinkCard key={u.id} game={game} u={u} carried={used[u.id] ?? 0} />)}
      </div>
      <h3 className="mkt-h">Transit</h3>
      <div className="shop-grid mkt-flat">
        {carriersAt(dc).map((c) => <TransitOrder key={c.id} game={game} loc={loc} carrier={c.id} />)}
      </div>
      <ExchangeOrder game={game} loc={loc} />
      <ZoneLinks game={game} loc={loc} />
    </>
  );
}

function Meter({ load }: { load: number }) {
  return <div className={`net-meter ${loadClass(load)}`}><span style={{ width: `${Math.min(100, load * 100)}%` }} /></div>;
}

function UplinkCard({ game, u, carried }: { game: GameState; u: Uplink; carried: number }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour);
  const cap = capacityMbps(u);
  const monthly = (u.kind === "transit" ? transitBill(game, u).amount : u.links.reduce((n, l) => n + exchangePortPrice(l.gbit, year), 0)) + crossConnects(game, u);
  const device = (id: string) => { const d = game.devices.find((x) => x.id === id); return d?.label ?? d?.name ?? id; };
  return (
    <div className="shop-card">
      <div className="mkt-head"><strong>{partnerName(u)}</strong><span className="pill">{u.kind === "transit" ? "Transit" : "Exchange"}</span></div>
      <ul className="net-links">
        {u.links.map((l) => (
          <li key={l.id}><span className="num">{l.gbit}G</span><span>{device(l.device)} port {l.port + 1}</span><span className="grow" />
            {l.readyAt > game.hour ? <span className="pill">From {formatDay(l.readyAt)}</span> : <span className="pill ok">Up</span>}</li>
        ))}
      </ul>
      <dl className="shop-specs">
        <div><dt>In use</dt><dd className="num">{mbps(carried)}</dd></div>
        {u.kind === "transit" && <div><dt>95th / commit</dt><dd className="num">{mbps(p95(u.samples))} / {mbps(cap * u.commit)}</dd></div>}
        <div><dt>Per month</dt><dd className="num">{euro(monthly)}</dd></div>
      </dl>
      <Meter load={cap ? carried / cap : 0} />
      <div className="shop-buy">
        <div className="seg" role="group" aria-label="Add link">
          {speedsIn(year).map((g) => <button key={g} className="num" onClick={() => act((s) => addUplinkLink(s, u.id, g))}>+{g}G</button>)}
        </div>
        <span className="grow" />
        <button className="btn" onClick={() => act((s) => cancelUplink(s, u.id))}>Cancel</button>
      </div>
    </div>
  );
}

function TransitOrder({ game, loc, carrier }: { game: GameState; loc: Location; carrier: string }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), speeds = speedsIn(year);
  const [gbit, setGbit] = useState(speeds[0]);
  const [commit, setCommit] = useState(COMMITS[0].share);
  const c = carrierById(carrier)!;
  const discount = COMMITS.find((x) => x.share === commit)!.discount;
  const price = transitPerMbps(c, year) * (1 - discount) * (1 - 0.1 * game.network.goodwill);
  return (
    <div className="shop-card">
      <div className="shop-name"><strong>{c.name}</strong><span>{euroCents(price)} per Mbit/s</span></div>
      <div className="mkt-row"><span className="mkt-label">Port</span>
        <div className="seg" role="group" aria-label="Port speed">{speeds.map((g) => <button key={g} className="num" aria-pressed={gbit === g} onClick={() => setGbit(g)}>{g}G</button>)}</div></div>
      <div className="mkt-row"><span className="mkt-label">Commit</span>
        <div className="seg" role="group" aria-label="Commit">{COMMITS.map((x) => <button key={x.share} className="num" aria-pressed={commit === x.share} onClick={() => setCommit(x.share)}>{pct(x.share)}</button>)}</div></div>
      <div className="shop-buy"><span className="num">From {euro(gbit * 1000 * commit * price)} / month</span><span className="grow" />
        <button className="btn primary" onClick={() => act((s) => orderTransit(s, loc.id, carrier, gbit, commit))}>Order</button></div>
    </div>
  );
}

function ExchangeOrder({ game, loc }: { game: GameState; loc: Location }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), speeds = speedsIn(year);
  const [gbit, setGbit] = useState(speeds[0]);
  const x = exchangeAt(datacenterById(loc.dc!));
  if (!x) return null;
  const member = game.network.memberships.includes(x.id);
  let action: ReactNode;
  if (!game.network.asn) action = <span className="pill">Needs an AS number</span>;
  else if (!member) action = <button className="btn primary" disabled={game.cash < EXCHANGE_FEES.setup} onClick={() => act((s) => joinExchange(s, x.id))}>Join for {euro(EXCHANGE_FEES.setup)}</button>;
  else action = <button className="btn primary" onClick={() => act((s) => orderExchangePort(s, loc.id, gbit))}>Order port</button>;
  return (
    <>
      <h3 className="mkt-h">Exchange</h3>
      <div className="shop-grid mkt-flat">
        <div className="shop-card">
          <div className="shop-name"><strong>{x.name}</strong><span>{datacenterById(loc.dc!).exchange!.onSite ? "On site" : "By cross-connect"}</span></div>
          <dl className="shop-specs">
            <div><dt>Membership</dt><dd className="num">{euro(EXCHANGE_FEES.yearly)} / year</dd></div>
            <div><dt>Port</dt><dd className="num">{euro(exchangePortPrice(gbit, year))} / month</dd></div>
          </dl>
          {member && <div className="mkt-row"><span className="mkt-label">Port</span>
            <div className="seg" role="group" aria-label="Port speed">{speeds.map((g) => <button key={g} className="num" aria-pressed={gbit === g} onClick={() => setGbit(g)}>{g}G</button>)}</div></div>}
          <div className="shop-buy"><span className="grow" />{action}</div>
        </div>
      </div>
    </>
  );
}

function ZoneLinks({ game, loc }: { game: GameState; loc: Location }) {
  const others = game.locations.filter((l) => l.dc && l.id !== loc.id);
  if (!others.length) return null;
  return (
    <>
      <h3 className="mkt-h">Links to other zones</h3>
      <div className="shop-grid mkt-flat">{others.map((o) => <ZoneLinkCard key={o.id} game={game} loc={loc} other={o} />)}</div>
    </>
  );
}

function ZoneLinkCard({ game, loc, other }: { game: GameState; loc: Location; other: Location }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), same = loc.city === other.city, overseas = inUs(loc.city) !== inUs(other.city);
  const [choice, setChoice] = useState<{ kind: ZoneLinkKind; gbit: number }>({ kind: "wave", gbit: 1 });
  const links = game.network.zoneLinks.filter((z) => (z.a === loc.id && z.b === other.id) || (z.b === loc.id && z.a === other.id));
  const options: { kind: ZoneLinkKind; gbit: number; label: string }[] = [
    ...speedsIn(year).map((g) => ({ kind: "wave" as const, gbit: g, label: `${g}G` })),
    ...(same ? [{ kind: "fiber" as const, gbit: FIBER_GBIT, label: "Dark fiber" }] : []),
  ];
  return (
    <div className="shop-card">
      <div className="shop-name"><strong>{other.az} {other.name}</strong><span>{same ? "Same region" : overseas ? "Overseas" : "Other region"}</span></div>
      {links.map((zl) => (
        <div key={zl.id} className="mkt-row net-zl">
          <span className="num">{zl.kind === "fiber" ? "Dark fiber" : `${zl.gbit}G`}</span>
          <span className="num">{zl.readyAt > game.hour ? `From ${formatDay(zl.readyAt)}` : mbps(zl.carried)}</span>
          <span className="num">{euro(zoneLinkMonthly(game, zl))} / month</span>
          <span className="grow" /><button className="btn" onClick={() => act((s) => cancelZoneLink(s, zl.id))}>Cancel</button>
        </div>
      ))}
      <div className="mkt-row"><span className="mkt-label">Link</span>
        <div className="seg" role="group" aria-label="Link">{options.map((o) => (
          <button key={o.label} className="num" aria-pressed={choice.kind === o.kind && choice.gbit === o.gbit} onClick={() => setChoice(o)}>{o.label}</button>
        ))}</div></div>
      <div className="shop-buy"><span className="num">{euro(zoneLinkPrice(choice.kind, choice.gbit, same, year, overseas))} / month</span><span className="grow" />
        <button className="btn primary" onClick={() => act((s) => orderZoneLink(s, loc.id, other.id, choice.kind, choice.gbit))}>Order</button></div>
    </div>
  );
}

function NetworkMap({ game }: { game: GameState }) {
  const markers = game.locations.flatMap((l): Marker[] => {
    const c = cityNamed(l.city);
    return c ? [{ id: l.id, lon: c.lon, lat: c.lat, label: `${l.az} ${l.name}`, kind: l.dc ? "location" : "basement", provider: l.dc ? datacenterById(l.dc).provider : null, alert: game.network.saturated.includes(l.id) }] : [];
  });
  return <WorldMap className="net-map" markers={markers} />;
}

const POLICY: Record<Peer["policy"], string> = { routeServer: "Route servers", open: "Open", selective: "Selective", restrictive: "Restrictive" };
const KIND: Record<Peer["kind"], string> = { eyeball: "Access network", content: "Content", cdn: "CDN", carrier: "Carrier", hoster: "Hoster", hobby: "Hobby network" };

function PeerFacts({ p }: { p: Peer }) {
  return (
    <dl className="shop-specs">
      <div><dt>Type</dt><dd>{KIND[p.kind]}</dd></div>
      <div><dt>Prefixes</dt><dd className="num">{p.prefixes.toLocaleString("en")}</dd></div>
      <div><dt>Traffic share</dt><dd className="num">{p.share < 0.01 ? "<1%" : pct(p.share)}</dd></div>
      <div><dt>Policy</dt><dd>{POLICY[p.policy]}</dd></div>
      <div><dt>Wants</dt><dd className="num">{p.minMbps ? mbps(p.minMbps) : "Any"}</dd></div>
      <div><dt>Exchanges</dt><dd>{p.exchanges.length > 4 ? "All" : p.exchanges.map((x) => exchangeById(x)!.name).join(", ")}</dd></div>
    </dl>
  );
}

function Peering({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const n = game.network, active = activeExchanges(game);
  const askable = PEERS.filter((p) => p.policy !== "routeServer" && p.exchanges.some((x) => active.includes(x)));
  return (
    <>
      {!n.asn && (
        <div className="shop-grid mkt-flat net-top">
          <div className="shop-card">
            <div className="shop-name"><strong>AS number</strong><span>Exchanges only accept members with their own network number.</span></div>
            <div className="shop-buy"><span className="num">{euro(ASN_FEE)}</span><span className="grow" />
              <button className="btn primary" disabled={game.cash < ASN_FEE} onClick={() => act(registerAsn)}>Register</button></div>
          </div>
        </div>
      )}
      <h3 className="mkt-h">Requests</h3>
      {n.requests.length ? (
        <div className="shop-grid mkt-flat">
          {n.requests.map((r) => {
            const p = PEERS.find((x) => x.id === r.peer)!;
            return (
              <div key={r.id} className="shop-card">
                <div className="mkt-head"><strong>{p.name}</strong><span className="pill">{exchangeById(r.exchange)!.name}</span></div>
                <PeerFacts p={p} />
                <div className="shop-buy"><span className="num">{formatDay(r.at)}</span><span className="grow" />
                  <button className="btn" onClick={() => act((s) => rejectPeering(s, r.id))}>Reject</button>
                  <button className="btn primary" onClick={() => act((s) => acceptPeering(s, r.id))}>Accept</button></div>
              </div>
            );
          })}
        </div>
      ) : <p className="mkt-none">No requests</p>}
      <h3 className="mkt-h">Networks</h3>
      {askable.length ? (
        <div className="shop-grid mkt-flat">
          {askable.map((p) => {
            const at = p.exchanges.find((x) => active.includes(x))!;
            const session = n.sessions.find((x) => x.peer === p.id);
            let state: ReactNode;
            if (session) state = <span className="pill ok">Peering</span>;
            else if (coolingDown(game, p.id)) state = <span className="pill">Declined</span>;
            else state = <button className="btn primary" onClick={() => act((s) => requestPeering(s, p.id, at))}>Ask</button>;
            return (
              <div key={p.id} className="shop-card">
                <div className="mkt-head"><strong>{p.name}</strong><span className="pill">{exchangeById(at)!.name}</span></div>
                <PeerFacts p={p} />
                <div className="shop-buy"><span className="num">{session ? "" : `${pct(acceptChance(game, p))} chance`}</span><span className="grow" />{state}</div>
              </div>
            );
          })}
        </div>
      ) : <p className="mkt-none">No exchange ports</p>}
    </>
  );
}

const PROTECTION_INFO: Record<Protection, { name: string; text: string }> = {
  none: { name: "No protection", text: "Attacks hit your links at full strength." },
  onDemand: { name: PROTECTIONS.onDemand.name, text: "Filters an attack once it is detected, about ten minutes in." },
  alwaysOn: { name: PROTECTIONS.alwaysOn.name, text: "Filters all traffic all the time." },
};

function Ddos({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const n = game.network;
  return (
    <>
      <h3 className="mkt-h">Protection</h3>
      <div className="shop-grid mkt-flat">
        {(["none", "onDemand", "alwaysOn"] as Protection[]).map((p) => {
          const def = p === "none" ? null : PROTECTIONS[p];
          return (
            <div key={p} className="shop-card">
              <div className="shop-name"><strong>{PROTECTION_INFO[p].name}</strong><span>{PROTECTION_INFO[p].text}</span></div>
              <dl className="shop-specs">
                <div><dt>Per month</dt><dd className="num">{euro(def?.monthly ?? 0)}</dd></div>
                <div><dt>Per attack</dt><dd className="num">{euro(def?.perIncident ?? 0)}</dd></div>
              </dl>
              <div className="shop-buy"><span className="grow" />
                {n.protection === p ? <span className="pill ok">Active</span> : <button className="btn" onClick={() => act((s) => setProtection(s, p))}>Switch</button>}</div>
            </div>
          );
        })}
      </div>
      <h3 className="mkt-h">Attacks</h3>
      {n.attacks.length ? (
        <div className="shop-grid mkt-flat">
          {n.attacks.map((a) => {
            const v = game.services.find((x) => x.id === a.serviceId);
            const loc = game.locations.find((l) => l.id === a.locationId);
            return (
              <div key={a.id} className="shop-card">
                <div className="mkt-head"><strong>{v?.label ?? a.serviceId}</strong>{a.blackholed ? <span className="pill">Blackholed</span> : <span className="pill net-pill-bad">Under attack</span>}</div>
                <dl className="shop-specs">
                  <div><dt>Zone</dt><dd>{loc ? `${loc.az} ${loc.name}` : ""}</dd></div>
                  <div><dt>Size</dt><dd className="num">{mbps(a.mbps)}</dd></div>
                  <div><dt>Ends</dt><dd className="num">{formatDay(a.endsAt)}</dd></div>
                </dl>
                <div className="shop-buy"><span className="grow" />
                  <button className={`btn${a.blackholed ? "" : " primary"}`} onClick={() => act((s) => setBlackhole(s, a.id, !a.blackholed))}>{a.blackholed ? "Lift blackhole" : "Blackhole"}</button></div>
              </div>
            );
          })}
        </div>
      ) : <p className="mkt-none">No attacks</p>}
    </>
  );
}
