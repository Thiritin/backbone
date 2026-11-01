import { t } from "../../../../i18n/en";
import { useState } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import { sizeSpec, SIZES } from "../../../../sim/10-catalog/products";
import { specText } from "../../../../sim/30-market/spec";
import type { Product } from "../../../../sim/30-customers/customers";
import type { GameState } from "../../../../sim/50-state";
import { eventOf, OFFER_HOURS } from "../../../../sim/80-business/community";
import { BOARD_MONTHS, BOARD_PRODUCTS, BOARD_SLOTS, offerOpen, type Ad } from "../../../../sim/80-business/sponsorboard";
import { acceptSponsorship, declineSponsorship, offerHalf, postOffer, withdrawOffer } from "../../../../sim/90-actions/community";
import { AUDIENCE } from "../../marketing/MarketingApp";
import { formatDay } from "../../billing/format";
import { PRODUCT } from "../../support/labels";
import { useStore } from "../../../store";
import { eraOf } from "./era";
import "./sponsorboard.css";
import { LOCALE } from "../../../../i18n/lang";

const AD: Record<Ad, string> = { banner: t("browser-sites-2.adBanner"), signature: t("browser-sites-2.adSignature"), stage: t("browser-sites-2.adStage") };
const monthsText = (n: number) => t("browser-sites-2.nMonths", { n });
const daysText = (h: number) => t("browser-sites-2.nDays", { n: h / 24 });
const ERAS = [{ from: 2005, look: "early" as const }, { from: 2014, look: "late" as const }];
// A member's avatar: a square in a colour of their own.
const Avatar = ({ name }: { name: string }) => <i className="sb-av" style={{ background: `hsl(${[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 55% 55%)` }} aria-hidden />;

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
  const year = yearOf(game.hour), look = eraOf(ERAS, year);
  const sizes = SIZES[product].map((_, i) => ({ id: i, text: specText(product, sizeSpec(product, i, year)) }));
  const offers = game.sponsorOffers.filter((o) => offerOpen(game, o));
  const applicants = game.sponsorships.filter((x) => x.board && x.status === "offered");
  const running = game.sponsorships.filter((x) => x.board && x.status === "running");
  const requests = game.sponsorships.filter((x) => !x.board && x.status === "offered");
  return (
    <div className={`sb ${look}`}>
      <header className="sb-head">
        <svg className="sb-mark" width="40" height="40" viewBox="0 0 24 24" aria-hidden><path d="M2 3h20v13H9l-5 5v-5H2z" fill="currentColor" /><path d="M6 8h12M6 11h8" stroke="#ffffff" strokeWidth="1.6" /></svg>
        <div><span className="sb-logo">Sponsor<i>-</i>Bored</span><span className="sb-sub">{t("browser-sites-2.sbSub")}</span></div>
      </header>
      {look === "early" && <div className="sb-crumb">{t("browser-sites-2.sbCrumb")}</div>}
      <main className="sb-main">
        <section className="sb-card">
          <h2>{t("browser-sites-2.sbRequests")}</h2>
          {requests.length ? requests.map((x) => {
            const ev = eventOf(x);
            return (
              <div key={x.id} className="sb-row">
                <Avatar name={ev.name} />
                <div className="sb-who">
                  <strong>{ev.name}</strong>
                  <div className="sb-meta"><span>{ev.audience.map((p) => AUDIENCE[p]).join(", ")}</span><span className="sb-num">{t("browser-sites-2.nPeople", { n: ev.people.toLocaleString(LOCALE) })}</span><span>{ev.kind === "tech" ? t("browser-sites-2.knowHow") : t("browser-sites-2.mentionEvent")}</span></div>
                  <div className="sb-meta"><span>{ev.count} × {specText(ev.product, sizeSpec(ev.product, ev.size, year))}</span><span>{daysText(ev.hours)}</span><span className="sb-num">{t("browser-sites-2.until", { date: formatDay(x.offeredAt + OFFER_HOURS) })}</span></div>
                </div>
                <div className="sb-acts">
                  {x.halfAt !== undefined ? <span className="sb-meta">{t("browser-sites-2.halfOffered")}</span> : <>
                    <button className="sb-button ghost" onClick={() => act(offerHalf, x.ticketId)}>{t("browser-sites-2.offerHalf")}</button>
                    <button className="sb-button" onClick={() => act(acceptSponsorship, x.ticketId)}>{t("browser-sites-2.offerFree")}</button>
                  </>}
                </div>
              </div>
            );
          }) : <p className="sb-none">{t("browser-sites-2.noRequests")}</p>}
        </section>
        <section className="sb-card">
          <h2>{t("browser-sites-2.postAnOffer")}</h2>
          <Seg label={t("browser-sites-2.product")} value={product} options={BOARD_PRODUCTS.map((p) => ({ id: p, text: PRODUCT[p] }))} onChange={(p) => { setProduct(p); setSize(0); }} />
          <Seg label={t("browser-sites-2.size")} value={size} options={sizes} onChange={setSize} />
          <Seg label={t("browser-sites-2.duration")} value={months} options={BOARD_MONTHS.map((m) => ({ id: m as number, text: monthsText(m) }))} onChange={setMonths} />
          <Seg label={t("browser-sites-2.slots")} value={slots} options={BOARD_SLOTS.map((n) => ({ id: n as number, text: String(n) }))} onChange={setSlots} />
          <Seg label={t("browser-sites-2.price")} value={free ? "free" : "half"} options={[{ id: "free", text: t("browser-sites-2.free") }, { id: "half", text: t("browser-sites-2.halfOff") }]} onChange={(v) => setFree(v === "free")} />
          <button className="sb-button" onClick={() => act(postOffer, { product, size, months, slots, free })}>{t("browser-sites-2.postOffer")}</button>
        </section>
        <section className="sb-card">
          <h2>{t("browser-sites-2.openOffers")}</h2>
          {offers.length ? offers.map((o) => (
            <div key={o.id} className="sb-row">
              <div className="sb-who">
                <strong>{specText(o.product, sizeSpec(o.product, o.size, year))}</strong>
                <div className="sb-meta"><span>{monthsText(o.months)}</span><span>{o.free ? t("browser-sites-2.free") : t("browser-sites-2.halfOff")}</span></div>
              </div>
              <div className="sb-meta sb-num"><span>{t("browser-sites-2.slotsTaken", { taken: o.taken, slots: o.slots })}</span><span>{t("browser-sites-2.applied", { n: o.sent })}</span></div>
              <div className="sb-acts"><button className="sb-button ghost" onClick={() => act(withdrawOffer, o.id)}>{t("browser-sites-2.withdraw")}</button></div>
            </div>
          )) : <p className="sb-none">{t("browser-sites-2.noOffers")}</p>}
        </section>
        <section className="sb-card">
          <h2>{t("browser-sites-2.applicants")}</h2>
          {applicants.length ? applicants.map((x) => {
            const b = x.board!, offer = game.sponsorOffers.find((o) => o.id === b.offerId)!;
            return (
              <div key={x.id} className="sb-row">
                <Avatar name={b.name} />
                <div className="sb-who">
                  <strong>{b.name}</strong>
                  <div className="sb-meta"><span>{AUDIENCE[b.profile]}</span><span className="sb-num">{t("browser-sites-2.nPeople", { n: b.audience.toLocaleString(LOCALE) })}</span><span>{AD[b.ad]}</span></div>
                </div>
                <div className="sb-acts">
                  <button className="sb-button ghost" onClick={() => act(declineSponsorship, x.ticketId)}>{t("browser-sites-2.decline")}</button>
                  <button className="sb-button" disabled={offer.taken >= offer.slots} onClick={() => act(acceptSponsorship, x.ticketId)}>{t("browser-sites-2.accept")}</button>
                </div>
              </div>
            );
          }) : <p className="sb-none">{t("browser-sites-2.noApplicants")}</p>}
        </section>
        <section className="sb-card">
          <h2>{t("browser-sites-2.running")}</h2>
          {running.length ? running.map((x) => {
            const b = x.board!;
            return (
              <div key={x.id} className="sb-row">
                <Avatar name={b.name} />
                <div className="sb-who">
                  <strong>{b.name}</strong>
                  <div className="sb-meta"><span>{AUDIENCE[b.profile]}</span><span>{AD[b.ad]}</span></div>
                </div>
                <div className="sb-meta sb-num"><span>{b.dropped ? t("browser-sites-2.bannerDropped") : t("browser-sites-2.bannerUp")}</span><span>{t("browser-sites-2.until", { date: formatDay(x.endsAt) })}</span></div>
              </div>
            );
          }) : <p className="sb-none">{t("browser-sites-2.nothingRunning")}</p>}
        </section>
      </main>
      <footer className="sb-foot">
        {look === "early" ? <>
          <span>{t("browser-sites-2.phpBored", { year })}</span>
          <span className="sb-counter">{t("browser-sites-2.visitors")} <b>{String(4711 + Math.floor(game.hour / 5)).padStart(7, "0")}</b></span>
        </> : <span>{t("browser-sites-2.sbFooter", { year })}</span>}
      </footer>
    </div>
  );
}
