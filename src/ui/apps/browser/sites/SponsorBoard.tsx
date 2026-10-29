import { useState } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import { sizeSpec, SIZES } from "../../../../sim/10-catalog/products";
import { specText } from "../../../../sim/30-market/spec";
import type { Product } from "../../../../sim/30-customers/customers";
import type { GameState } from "../../../../sim/50-state";
import { BOARD_MONTHS, BOARD_PRODUCTS, BOARD_SLOTS, offerOpen, type Ad } from "../../../../sim/80-business/sponsorboard";
import { acceptSponsorship, declineSponsorship, postOffer, withdrawOffer } from "../../../../sim/90-actions/community";
import { AUDIENCE } from "../../marketing/MarketingApp";
import { formatDay } from "../../billing/BillingApp";
import { PRODUCT } from "../../support/labels";
import { useStore } from "../../../store";
import "./pages.css";

const AD: Record<Ad, string> = { banner: "Banner on the site", signature: "Forum signature", stage: "Mention on stage" };
const monthsText = (n: number) => (n === 1 ? "1 month" : `${n} months`);

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="sb-field">
      <span className="sb-label">{label}</span>
      <div className="sb-seg" role="group" aria-label={label}>
        {options.map((o) => <button key={String(o.id)} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.text}</button>)}
      </div>
    </div>
  );
}

// The sponsor board: servers for a clan, a fan site or a student project in return for a logo.
export function SponsorBoard({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [product, setProduct] = useState<Product>("gameServer");
  const [size, setSize] = useState(0);
  const [months, setMonths] = useState<number>(3);
  const [slots, setSlots] = useState<number>(1);
  const [free, setFree] = useState(true);
  const year = yearOf(game.hour);
  const sizes = SIZES[product].map((_, i) => ({ id: i, text: specText(product, sizeSpec(product, i, year)) }));
  const offers = game.sponsorOffers.filter((o) => offerOpen(game, o));
  const applicants = game.sponsorships.filter((x) => x.board && x.status === "offered");
  const running = game.sponsorships.filter((x) => x.board && x.status === "running");
  return (
    <div className="sb">
      <header className="sb-head"><span className="sb-logo">Sponsor<i>-</i>Bored</span><span>Servers wanted, logos welcome.</span></header>
      <main className="sb-main">
        <section className="sb-card">
          <h2>Post an offer</h2>
          <Seg label="Product" value={product} options={BOARD_PRODUCTS.map((p) => ({ id: p, text: PRODUCT[p] }))} onChange={(p) => { setProduct(p); setSize(0); }} />
          <Seg label="Size" value={size} options={sizes} onChange={setSize} />
          <Seg label="Duration" value={months} options={BOARD_MONTHS.map((m) => ({ id: m as number, text: monthsText(m) }))} onChange={setMonths} />
          <Seg label="Slots" value={slots} options={BOARD_SLOTS.map((n) => ({ id: n as number, text: String(n) }))} onChange={setSlots} />
          <Seg label="Price" value={free ? "free" : "half"} options={[{ id: "free", text: "Free" }, { id: "half", text: "50% off" }]} onChange={(v) => setFree(v === "free")} />
          <button className="sb-button" onClick={() => act(postOffer, { product, size, months, slots, free })}>Post offer</button>
        </section>
        <section className="sb-card">
          <h2>Open offers</h2>
          {offers.length ? offers.map((o) => (
            <div key={o.id} className="sb-row">
              <div className="sb-who">
                <strong>{specText(o.product, sizeSpec(o.product, o.size, year))}</strong>
                <div className="sb-meta"><span>{monthsText(o.months)}</span><span>{o.free ? "Free" : "50% off"}</span></div>
              </div>
              <div className="sb-meta sb-num"><span>{o.taken} of {o.slots} slots</span><span>{o.sent} applied</span></div>
              <div className="sb-acts"><button className="sb-button ghost" onClick={() => act(withdrawOffer, o.id)}>Withdraw</button></div>
            </div>
          )) : <p className="sb-none">No open offers.</p>}
        </section>
        <section className="sb-card">
          <h2>Applicants</h2>
          {applicants.length ? applicants.map((x) => {
            const b = x.board!, offer = game.sponsorOffers.find((o) => o.id === b.offerId)!;
            return (
              <div key={x.id} className="sb-row">
                <div className="sb-who">
                  <strong>{b.name}</strong>
                  <div className="sb-meta"><span>{AUDIENCE[b.profile]}</span><span className="sb-num">{b.audience.toLocaleString("en-US")} people</span><span>{AD[b.ad]}</span></div>
                </div>
                <div className="sb-acts">
                  <button className="sb-button ghost" onClick={() => act(declineSponsorship, x.ticketId)}>Decline</button>
                  <button className="sb-button" disabled={offer.taken >= offer.slots} onClick={() => act(acceptSponsorship, x.ticketId)}>Accept</button>
                </div>
              </div>
            );
          }) : <p className="sb-none">No applicants.</p>}
        </section>
        <section className="sb-card">
          <h2>Running</h2>
          {running.length ? running.map((x) => {
            const b = x.board!;
            return (
              <div key={x.id} className="sb-row">
                <div className="sb-who">
                  <strong>{b.name}</strong>
                  <div className="sb-meta"><span>{AUDIENCE[b.profile]}</span><span>{AD[b.ad]}</span></div>
                </div>
                <div className="sb-meta sb-num"><span>{b.dropped ? "Banner dropped" : "Banner up"}</span><span>until {formatDay(x.endsAt)}</span></div>
              </div>
            );
          }) : <p className="sb-none">Nothing running.</p>}
        </section>
      </main>
    </div>
  );
}
