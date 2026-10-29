import { useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { freeBlock, LINE_EXTRA_V4, LIR_FEES, providerV4, transferPrice } from "../../../sim/10-catalog/addresses";
import type { GameState, Location } from "../../../sim/50-state";
import {
  addressesOf, dynamicLine, freeV4, ipmiIp, lineActive, machineLocation, privateIp, publicV4, publicV6, v6Offered, type Address, type AddressSource,
} from "../../../sim/60-infra/addresses";
import { addAddress, announceBlock, assignAddress, buyAddresses, buyBlock, joinLir, releaseAddress, requestDelist } from "../../../sim/90-actions/addresses";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import { devName } from "../hw";
import { vmLabel } from "../products/parts";

const SOURCE: Record<AddressSource, string> = { line: "Home line", lineExtra: "Home line extra", provider: "Provider", lir: "Own block" };
const COUNTS = [1, 4, 16];

// Where the company can get more addresses for a location: from the provider in a datacenter, on a static line at home.
const canBuy = (game: GameState, loc: Location) => !!loc.dc || (lineActive(game) && !dynamicLine(game));

export function holderName(game: GameState, holder: string | null): string {
  if (!holder) return "Free";
  if (holder.startsWith("gw:")) return "Router";
  const d = game.devices.find((x) => x.id === holder);
  if (d) return devName(d);
  const w = game.workloads.find((x) => x.id === holder);
  if (w) return vmLabel(game, w).name;
  const v = game.services.find((x) => x.id === holder), c = game.customers.find((x) => x.id === v?.customerId);
  return [c?.name, v?.domain ?? v?.label].filter(Boolean).join(", ") || holder;
}

function RepCell({ a }: { a: Address }) {
  if (a.v === 6) return <span className="loc-muted">None</span>;
  return <>
    <span className="num">{Math.round(a.rep)}</span>
    {a.listed && <span className={`pill ${a.delistAt !== null ? "warn" : "bad"}`}>{a.delistAt !== null ? "Delisting" : "Listed"}</span>}
  </>;
}

// A server's or VM's addresses, as rows of its facts list.
export function AddressRows({ game, id }: { game: GameState; id: string }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const loc = machineLocation(game, id), mgmt = ipmiIp(game, id);
  if (!loc) return null;
  const v4 = publicV4(game, id), v6 = publicV6(game, id);
  const own = addressesOf(game, id).filter((a) => a.v === 4);
  // Datacenter servers keep their address; VMs and basement servers can give theirs back.
  const fixed = !!loc.dc && game.devices.some((d) => d.id === id);
  return <>
    <div><dt>Private IP</dt><dd className="num">{privateIp(game, id) ?? "None"}</dd></div>
    {mgmt && (
      <div>
        <dt>Management</dt>
        <dd><button className="loc-link num" onClick={() => openApp("Browser", { kind: "url", id: `http://${mgmt}/` })}>{mgmt}</button></dd>
      </div>
    )}
    <div>
      <dt>Public IPv4</dt>
      <dd>
        {own.length ? own.map((a) => (
          <span key={a.id} className="net-addr">
            <span className="num">{a.ip}</span>
            {!fixed && <button className="btn ghost" onClick={() => act(assignAddress, a.id, null)}>Unassign</button>}
          </span>
        )) : v4 ? <><span className="num">{v4.ip}</span><span className="pill">Shared</span></> : "None"}
        {canBuy(game, loc) && <button className="btn" onClick={() => act(addAddress, id, 4)}>Add</button>}
      </dd>
    </div>
    <div>
      <dt>IPv6</dt>
      <dd>
        {v6 ? <span className="num">{v6}</span> : "None"}
        {!v6 && v6Offered(game, loc) && <button className="btn" onClick={() => act(addAddress, id, 6)}>Add</button>}
      </dd>
    </div>
  </>;
}

// A zone's public addresses and where more come from.
export function AddressList({ game, loc }: { game: GameState; loc: Location }) {
  const act = useStore((s) => s.act);
  const [count, setCount] = useState(COUNTS[0]);
  const list = game.ips.addresses.filter((a) => a.locationId === loc.id);
  const rented = game.ips.addresses.filter((a) => a.source === "provider" && a.v === 4).length;
  const price = loc.dc ? providerV4(yearOf(game.hour), rented + count) : LINE_EXTRA_V4;
  const buy = canBuy(game, loc);
  return (
    <div className="net-addrs">
      <dl className="fin-facts">
        <div><dt>IPv4</dt><dd className="num">{list.filter((a) => a.v === 4).length}</dd></div>
        <div><dt>Free IPv4</dt><dd className="num">{freeV4(game, loc.id)}</dd></div>
        <div><dt>IPv6</dt><dd>{v6Offered(game, loc) ? "Available" : "Not available"}</dd></div>
        <div><dt>Listed</dt><dd className="num">{list.filter((a) => a.listed).length}</dd></div>
      </dl>
      {buy && (
        <div className="net-buy">
          <div className="seg" role="group" aria-label="Count">
            {COUNTS.map((n) => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{n}</button>)}
          </div>
          <span className="num">{euroCents(price)} per IPv4 per month</span>
          <span className="grow" />
          <button className="btn primary" onClick={() => act(buyAddresses, loc.id, 4, count)}>Buy IPv4</button>
          {loc.dc && v6Offered(game, loc) && <button className="btn" onClick={() => act(buyAddresses, loc.id, 6, count)}>Buy IPv6</button>}
        </div>
      )}
      {list.length ? (
        <table className="table fin-table">
          <thead><tr><th>Address</th><th>Assigned to</th><th>Source</th><th>Reputation</th><th /></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="num">{a.ip}</td>
                <td>{holderName(game, a.holder)}</td>
                <td>{SOURCE[a.source]}</td>
                <td><RepCell a={a} /></td>
                <td className="r">
                  {a.listed && a.delistAt === null && !(a.source === "line" && dynamicLine(game)) &&
                    <button className="btn" onClick={() => act(requestDelist, a.id)}>Delist</button>}
                  {!a.holder && (a.source === "provider" || a.source === "lineExtra") &&
                    <button className="btn" onClick={() => act(releaseAddress, a.id)}>Release</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="loc-muted">No public addresses in this zone.</p>}
    </div>
  );
}

// Membership in RIPE NCC: the AS number and the company's own address blocks.
export function Ripe({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), lir = game.ips.lir, dcs = game.locations.filter((l) => l.dc);
  const free = freeBlock(game.hour);
  if (!lir) {
    return (
      <div className="shop-grid net-top">
        <div className="shop-card">
          <div className="shop-name"><strong>RIPE NCC membership</strong><span>Members get an AS number and their own address blocks to announce from a datacenter.</span></div>
          <dl className="shop-specs">
            <div><dt>Sign-up</dt><dd className="num">{euro(LIR_FEES.signup)}</dd></div>
            <div><dt>Per year</dt><dd className="num">{euro(LIR_FEES.yearly)}</dd></div>
            <div><dt>First block</dt><dd className="num">{free ? `/${free.prefix}, ${free.size.toLocaleString("en")} addresses` : "None"}</dd></div>
          </dl>
          <div className="shop-buy"><span className="grow" /><button className="btn primary" onClick={() => act(joinLir)}>Join</button></div>
        </div>
      </div>
    );
  }
  return (
    <div className="net-addrs">
      <dl className="fin-facts">
        <div><dt>AS number</dt><dd className="num">AS{lir.asn}</dd></div>
        <div><dt>Member since</dt><dd className="num">{formatDay(lir.since)}</dd></div>
        <div><dt>Per year</dt><dd className="num">{euro(LIR_FEES.yearly)}</dd></div>
      </dl>
      <div className="net-buy">
        <span>One /24 on the transfer market</span>
        <span className="num">{euro(256 * transferPrice(year))}</span>
        <span className="grow" />
        <button className="btn primary" onClick={() => act(buyBlock)}>Buy /24</button>
      </div>
      <table className="table fin-table">
        <thead><tr><th>Block</th><th className="r">Addresses</th><th className="r">In use</th><th>Announced from</th></tr></thead>
        <tbody>
          {game.ips.blocks.map((b) => (
            <tr key={b.id}>
              <td className="num">{b.prefix}</td>
              <td className="num r">{b.size.toLocaleString("en")}</td>
              <td className="num r">{game.ips.addresses.filter((a) => a.blockId === b.id && a.holder).length}</td>
              <td>
                <div className="seg" role="group" aria-label="Announced from">
                  {dcs.map((l) => <button key={l.id} aria-pressed={b.locationId === l.id} onClick={() => b.locationId !== l.id && act(announceBlock, b.id, l.id)}>{l.az}</button>)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
