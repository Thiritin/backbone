import { useMemo, useState, type ReactNode } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import {
  carrierById, carriersAt, COMMITS, dcPerTb, EXCHANGE_FEES, exchangeAt, exchangeById, exchangePortPrice, FIBER_GBIT, PEERS, speedsIn,
  transitPerMbps, zoneLinkPrice, ASN_FEE, type Peer, type ZoneLinkKind,
} from "../../../sim/10-catalog/network";
import { datacenterById, homeLineById, inUs } from "../../../sim/20-world/datacenters";
import type { GameState, Location } from "../../../sim/50-state";
import {
  acceptChance, activeExchanges, capacityMbps, coolingDown, crossConnects, homePeak, p95, route, transitBill, zoneLinkMonthly, type Uplink,
} from "../../../sim/60-infra/network";
import { routerMbps } from "../../../sim/60-infra/routers";
import {
  acceptPeering, addUplinkLink, cancelUplink, cancelZoneLink, joinExchange, orderExchangePort, orderTransit, orderZoneLink, registerAsn, rejectPeering,
  requestPeering, setBlackhole,
} from "../../../sim/90-actions/network";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import { readyIn } from "../hw";
import { AddressList } from "../network/Addresses";
import { Topology } from "../network/Topology";
import "../shop/shop.css";
import "../billing/billing.css";
import "../marketing/marketing.css";
import "../network/network.css";

export const mbps = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} Gbit/s` : `${v >= 10 ? Math.round(v) : v.toFixed(v >= 1 ? 1 : 2)} Mbit/s`);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const partnerName = (u: Uplink) => carrierById(u.partner)?.name ?? exchangeById(u.partner)?.name ?? u.partner;
export const loadClass = (load: number) => (load >= 0.9 ? "bad" : load >= 0.6 ? "warn" : "ok");

// The location's exchange once the player has a port there.
const portAt = (game: GameState, loc: Location): string | undefined => {
  const x = loc.dc ? exchangeAt(datacenterById(loc.dc)) : undefined;
  return x && activeExchanges(game).includes(x.id) ? x.id : undefined;
};

// Peering requests and attacks waiting at the location, for the tab count.
export const networkCount = (game: GameState, loc: Location): number => {
  const x = portAt(game, loc);
  return game.network.requests.filter((r) => r.exchange === x).length + game.network.attacks.filter((a) => a.locationId === loc.id).length;
};

type View = "uplinks" | "peering" | "addresses" | "topology";

export function NetworkTab({ game, loc }: { game: GameState; loc: Location }) {
  const [view, setView] = useState<View>("uplinks");
  const routing = useMemo(() => route(game), [game]);
  const z = routing.zones[loc.id];
  const views: View[] = portAt(game, loc) ? ["uplinks", "peering", "addresses", "topology"] : ["uplinks", "addresses", "topology"];
  const shown = views.includes(view) ? view : "uplinks";
  return (
    <>
      <div className="net-head">
        <span className="num net-now">{mbps(z?.carried ?? 0)} of {mbps(z?.demand ?? 0)}</span>
        <span className="grow" />
        <div className="seg" role="group" aria-label="View">
          {views.map((v) => <button key={v} aria-pressed={shown === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
      </div>
      <TrafficChart points={game.network.history[loc.id] ?? []} />
      {shown === "uplinks" && <><Attacks game={game} loc={loc} /><Uplinks game={game} loc={loc} routing={routing} /></>}
      {shown === "peering" && <Peering game={game} exchange={portAt(game, loc)!} />}
      {shown === "addresses" && <AddressList game={game} loc={loc} />}
      {shown === "topology" && <Topology game={game} loc={loc} routing={routing} />}
    </>
  );
}

function Attacks({ game, loc }: { game: GameState; loc: Location }) {
  const act = useStore((s) => s.act);
  const attacks = game.network.attacks.filter((a) => a.locationId === loc.id);
  if (!attacks.length) return null;
  return (
    <>
      <h3 className="mkt-h">Attacks</h3>
      <div className="shop-grid mkt-flat">
        {attacks.map((a) => (
          <div key={a.id} className="shop-card">
            <div className="mkt-head"><strong>{game.services.find((x) => x.id === a.serviceId)?.label ?? a.serviceId}</strong>
              {a.blackholed ? <span className="pill">Blackholed</span> : <span className="pill net-pill-bad">Under attack</span>}</div>
            <dl className="shop-specs">
              <div><dt>Size</dt><dd className="num">{mbps(a.mbps)}</dd></div>
              <div><dt>Ends</dt><dd className="num">{formatDay(a.endsAt)}</dd></div>
            </dl>
            <div className="shop-buy"><span className="grow" />
              <button className={`btn${a.blackholed ? "" : " primary"}`} onClick={() => act(setBlackhole, a.id, !a.blackholed)}>{a.blackholed ? "Lift blackhole" : "Blackhole"}</button></div>
          </div>
        ))}
      </div>
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
            <div><dt>Upload</dt><dd className="num">{mbps(Math.min(line.up, routerMbps(game, loc)))}</dd></div>
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
      {game.unlocks.includes("network") && <>
        <h3 className="mkt-h">Transit</h3>
        <div className="shop-grid mkt-flat">
          {carriersAt(dc).map((c) => <TransitOrder key={c.id} game={game} loc={loc} carrier={c.id} />)}
        </div>
        <ExchangeOrder game={game} loc={loc} />
        <ZoneLinks game={game} loc={loc} />
      </>}
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
            {l.readyAt > game.hour ? <span className="pill warn">Ready in {readyIn(l.readyAt, game.hour)}</span> : <span className="pill ok">Up</span>}</li>
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
          {speedsIn(year).map((g) => <button key={g} className="num" onClick={() => act(addUplinkLink, u.id, g)}>+{g}G</button>)}
        </div>
        <span className="grow" />
        <button className="btn" onClick={() => act(cancelUplink, u.id)}>Cancel</button>
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
        <button className="btn primary" onClick={() => act(orderTransit, loc.id, carrier, gbit, commit)}>Order</button></div>
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
  if (!game.network.asn) action = <button className="btn" disabled={game.cash < ASN_FEE} onClick={() => act(registerAsn)}>Register AS number for {euro(ASN_FEE)}</button>;
  else if (!member) action = <button className="btn primary" disabled={game.cash < EXCHANGE_FEES.setup} onClick={() => act(joinExchange, x.id)}>Join for {euro(EXCHANGE_FEES.setup)}</button>;
  else action = <button className="btn primary" onClick={() => act(orderExchangePort, loc.id, gbit)}>Order port</button>;
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
          <span className="num">{zl.readyAt > game.hour ? `Ready in ${readyIn(zl.readyAt, game.hour)}` : mbps(zl.carried)}</span>
          <span className="num">{euro(zoneLinkMonthly(game, zl))} / month</span>
          <span className="grow" /><button className="btn" onClick={() => act(cancelZoneLink, zl.id)}>Cancel</button>
        </div>
      ))}
      <div className="mkt-row"><span className="mkt-label">Link</span>
        <div className="seg" role="group" aria-label="Link">{options.map((o) => (
          <button key={o.label} className="num" aria-pressed={choice.kind === o.kind && choice.gbit === o.gbit} onClick={() => setChoice(o)}>{o.label}</button>
        ))}</div></div>
      <div className="shop-buy"><span className="num">{euro(zoneLinkPrice(choice.kind, choice.gbit, same, year, overseas))} / month</span><span className="grow" />
        <button className="btn primary" onClick={() => act(orderZoneLink, loc.id, other.id, choice.kind, choice.gbit)}>Order</button></div>
    </div>
  );
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

function Peering({ game, exchange }: { game: GameState; exchange: string }) {
  const act = useStore((s) => s.act);
  const n = game.network;
  const requests = n.requests.filter((r) => r.exchange === exchange);
  const askable = PEERS.filter((p) => p.policy !== "routeServer" && p.exchanges.includes(exchange));
  return (
    <>
      <h3 className="mkt-h">Requests</h3>
      {requests.length ? (
        <div className="shop-grid mkt-flat">
          {requests.map((r) => {
            const p = PEERS.find((x) => x.id === r.peer)!;
            return (
              <div key={r.id} className="shop-card">
                <div className="mkt-head"><strong>{p.name}</strong></div>
                <PeerFacts p={p} />
                <div className="shop-buy"><span className="num">{formatDay(r.at)}</span><span className="grow" />
                  <button className="btn" onClick={() => act(rejectPeering, r.id)}>Reject</button>
                  <button className="btn primary" onClick={() => act(acceptPeering, r.id)}>Accept</button></div>
              </div>
            );
          })}
        </div>
      ) : <p className="mkt-none">No requests</p>}
      <h3 className="mkt-h">Networks at {exchangeById(exchange)!.name}</h3>
      <div className="shop-grid mkt-flat">
        {askable.map((p) => {
          const session = n.sessions.find((x) => x.peer === p.id && x.exchange === exchange);
          let state: ReactNode;
          if (session) state = <span className="pill ok">Peering</span>;
          else if (coolingDown(game, p.id)) state = <span className="pill">Declined</span>;
          else state = <button className="btn primary" onClick={() => act(requestPeering, p.id, exchange)}>Ask</button>;
          return (
            <div key={p.id} className="shop-card">
              <div className="mkt-head"><strong>{p.name}</strong></div>
              <PeerFacts p={p} />
              <div className="shop-buy"><span className="num">{session ? "" : `${pct(acceptChance(game, p))} chance`}</span><span className="grow" />{state}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
