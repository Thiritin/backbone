import { Gavel, ShoppingBag, Tag, X } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { modelById } from "../../../sim/10-catalog/hardware";
import { defaultVendor, VENDOR_NAME, VENDORS, type Vendor } from "../../../sim/10-catalog/cpus";
import { CHANNELS, channelName, currentBid, EBUY_FEE, leading, onMarket, SELL_ASK, SELL_START, shipHours, type Channel, type Defect, type Listing } from "../../../sim/10-catalog/used";
import type { GameState } from "../../../sim/50-state";
import { deviceValue } from "../../../sim/60-infra/status";
import { bidListing, buyListing, cancelListing, listForSale } from "../../../sim/90-actions/used";
import { Isometric } from "../../art/Isometric";
import { BrandLogo } from "../../art/logos";
import { useSessionState } from "../../session";
import { useStore } from "../../store";
import { day } from "../hw";
import "./used.css";

const DEFECT: Record<Defect, string> = { psu: "PSU 2 missing", drive: "1 drive reports errors", rails: "No rails" };
const days = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} days` : h >= 24 ? "1 day" : `${Math.max(1, h)} h`);
const years = (y: number) => `${y.toFixed(1)} ${y === 1 ? "year" : "years"}`;
// A server listing's CPU maker; older listings carry the preset's.
const listingVendor = (l: Listing): Vendor | undefined => {
  const m = modelById(l.model);
  return m.server ? l.vendor ?? defaultVendor(m.server.arch) : undefined;
};

function Money({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="used-input">
      <input type="number" min={1} step={1} aria-label={label} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Math.round(Number(e.target.value)))} />
      <span aria-hidden>€</span>
    </span>
  );
}

function ListingCard({ game, l, to }: { game: GameState; l: Listing; to: string }) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const m = modelById(l.model), city = game.locations.find((x) => x.id === to)!.city;
  const bid = currentBid(l), auction = l.channel === "ebuy";
  const [max, setMax] = useState(Math.ceil((bid * 1.1) / 10) * 10);
  const name = `${l.qty > 1 ? `${l.qty} × ` : ""}${m.name}`;
  const buy = () => {
    if (act(buyListing, l.id, to).ok) notify("Shop", `${name} bought`, `Arrives ${day(game.hour + shipHours(l, city))}`);
  };
  const place = () => {
    if (act(bidListing, l.id, max, to).ok) notify("Shop", `Bid on ${name}`, `Maximum ${euro(max)}`);
  };
  const vendor = listingVendor(l);
  const rows: [string, string][] = [
    ...(vendor ? [["CPU", VENDOR_NAME[vendor]]] as [string, string][] : []),
    ["Age", years(l.age)],
    ["Seller", l.city],
    [auction ? "Ends" : "Listed for", days(l.expiresAt - game.hour)],
    ["Shipping", days(shipHours(l, city))],
    ...(l.defect ? [["Defect", DEFECT[l.defect]]] as [string, string][] : []),
    ...(l.bid ? [["Your maximum", euro(l.bid)]] as [string, string][] : []),
  ];
  return (
    <div className="shop-card">
      <div className="shop-pic"><Isometric model={m} brand={l.brand} w={170} count={Math.min(l.qty, 4)} /></div>
      <div className="shop-name">
        <strong>{name}</strong>
        <span className="shop-maker"><BrandLogo brand={l.brand} size={14} />{l.brand}{l.bid && <span className={`pill ${leading(l) ? "ok" : "warn"}`}>{leading(l) ? "Leading" : "Outbid"}</span>}</span>
      </div>
      <dl className="shop-specs">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>
      <div className="shop-buy">
        {auction ? (
          <>
            <span className="used-price"><span className="shop-muted">Current bid</span><strong className="num">{euro(bid)}</strong></span>
            <span className="grow" />
            <Money value={max} onChange={setMax} label="Maximum bid" />
            <button className="btn primary" disabled={!(max > bid) || max > game.cash} onClick={place}><Gavel />Bid</button>
          </>
        ) : (
          <>
            <strong className="num">{euro(l.price)}</strong>
            <span className="grow" />
            <button className="btn primary" disabled={l.price > game.cash} onClick={buy}><ShoppingBag />Buy</button>
          </>
        )}
      </div>
    </div>
  );
}

function Mine({ l }: { l: Listing }) {
  const act = useStore((s) => s.act);
  const d = l.device!;
  return (
    <div className="used-mine">
      <Isometric model={modelById(d.model)} brand={d.brand} w={64} />
      <div className="used-mine-name">
        <strong>{d.name}</strong>
        <span className="num shop-muted">{l.channel === "ebuy" ? `Starts at ${euro(l.price)}` : `Ask ${euro(l.price)}`} · Until {day(l.expiresAt)}</span>
      </div>
      <span className="grow" />
      <button className="btn" onClick={() => act(cancelListing, l.id)}><X />Take down</button>
    </div>
  );
}

// The Shop's Used market: one channel at a time, its listings that pass the sidebar as cards and the player's own listings on it.
export function Used({ channel, setChannel, keep }: { channel: Channel; setChannel: (c: Channel) => void; keep: (l: Listing) => boolean }) {
  const game = useStore((s) => s.game);
  const [to, setTo] = useSessionState("shop.usedTo", game.locations[0].id);
  const dest = game.locations.some((l) => l.id === to) ? to : game.locations[0].id;
  const [vendor, setVendor] = useSessionState<Vendor | null>("shop.usedVendor", null);
  const listed = game.used.filter((l) => l.channel === channel && onMarket(game, l)).filter(keep);
  const shown = listed.filter((l) => !vendor || listingVendor(l) === vendor).sort((a, b) => a.expiresAt - b.expiresAt);
  const vendors = VENDORS.filter((v) => v === vendor || listed.some((l) => listingVendor(l) === v));
  const mine = game.used.filter((l) => l.channel === channel && l.device);
  return (
    <div className="used">
      <div className="shop-bar used-bar">
        <div className="seg" role="group" aria-label="Channel">
          {CHANNELS.map((c) => <button key={c.id} aria-pressed={channel === c.id} onClick={() => setChannel(c.id)}>{c.name}</button>)}
        </div>
        {vendors.length > 0 && (
          <div className="shop-filter-row" role="group" aria-label="Vendor">
            {vendors.map((v) => (
              <button key={v} className="shop-chip" aria-pressed={vendor === v} onClick={() => setVendor(vendor === v ? null : v)}>
                {VENDOR_NAME[v]} <span className="num">{listed.filter((l) => listingVendor(l) === v).length}</span>
              </button>
            ))}
          </div>
        )}
        <span className="grow" />
        {channel === "board" && <span className="used-rep">Reputation <strong className="num">{game.usedRep}</strong></span>}
        {game.locations.length > 1 && (
          <div className="seg" role="group" aria-label="Ship to">
            {game.locations.map((l) => <button key={l.id} className="num" title={l.name} aria-pressed={l.id === dest} onClick={() => setTo(l.id)}>{l.az}</button>)}
          </div>
        )}
      </div>
      <div className="shop-grid">
        {shown.map((l) => <ListingCard key={l.id} game={game} l={l} to={dest} />)}
        {!shown.length && <div className="shop-none">No listings</div>}
        {mine.length > 0 && (
          <section className="used-mine-list">
            <h3>Your listings</h3>
            {mine.map((l) => <Mine key={l.id} l={l} />)}
          </section>
        )}
      </div>
    </div>
  );
}

// "List for sale" on a stored device: the board at an ask, or eBuy from half the value.
export function ListForSale({ game, id, onDone }: { game: GameState; id: string; onDone: () => void }) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const d = game.devices.find((x) => x.id === id)!, value = deviceValue(game, d);
  const [channel, setChannel] = useState<"board" | "ebuy">("board");
  const [ask, setAsk] = useState(Math.round(value * SELL_ASK));
  const list = () => {
    if (!act(listForSale, id, channel, channel === "board" ? ask : undefined).ok) return;
    notify("Shop", `${d.name} listed`, channelName(channel));
    onDone();
  };
  return (
    <div className="loc-row loc-ship">
      <div className="seg" role="group" aria-label="Channel">
        <button aria-pressed={channel === "board"} onClick={() => setChannel("board")}>WebHostingTalc</button>
        <button aria-pressed={channel === "ebuy"} onClick={() => setChannel("ebuy")}>eBuy</button>
      </div>
      <span className="grow" />
      <span className="num loc-muted">Value {euro(value)}</span>
      {channel === "board" ? <Money value={ask} onChange={setAsk} label="Ask" /> : <span className="num">Starts at {euro(Math.round(value * SELL_START))} · Fee {EBUY_FEE * 100}%</span>}
      <button className="btn primary" disabled={channel === "board" && !(ask >= 1)} onClick={list}><Tag />List</button>
    </div>
  );
}
