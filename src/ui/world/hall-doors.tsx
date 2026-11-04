// GDD, Own datacenter, Service doors: the transformer room and the meet-me room drawn large. An empty spot carries a paper tag with
// its price; the tag opens a slip, and signing it buys the part or builds the carrier in. Bought parts are drawn in place.
import { useState, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { euro } from "../../sim/00-core/money";
import { HALL, hallKw, isHalle, type HallUpgrade } from "../../sim/20-world/properties";
import type { Location } from "../../sim/50-state";
import { buildCarrier, buyHallUpgrade, buyTransformer, cityCarriers, hallAt } from "../../sim/90-actions/hall";
import { useStore } from "../store";
import { Slab } from "./panel/Slab";
import "./hall.css";

// A stable colour for a carrier or an exchange.
export const hueOf = (id: string): number => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

interface Offer { key: string; name: string; price: number; monthly?: number; run: () => { ok: boolean; error?: string } }

// One spot in a room: the art above, and below it either the part's label or a paper tag for the empty spot.
function Spot({ art, label, offer, open, onOpen }: { art: ReactNode; label: string; offer?: Offer; open: boolean; onOpen: (key: string | null) => void }) {
  return (
    <div className="wp-unit hd-spot">
      {art}
      {offer
        ? <button onClick={() => onOpen(open ? null : offer.key)} aria-expanded={open}><span className="wp-label"><b>{label}</b><span className="num">{euro(offer.price)}</span></span></button>
        : <span className="wp-label"><b>{label}</b></span>}
    </div>
  );
}

function Slip({ offer, onDone }: { offer: Offer; onDone: () => void }) {
  const [refused, setRefused] = useState<string | null>(null);
  const sign = () => { const r = offer.run(); if (r.ok) onDone(); else setRefused(r.error ?? "error.noCash"); };
  return (
    <div className="wr-tag wr-slip hd-slip" data-slip="">
      <div className="wr-tag-body">
        <div className="wr-tag-h"><strong>{offer.name}</strong></div>
        <div className="wr-model">{euro(offer.price)}{offer.monthly ? ` · ${t("locations-2.perMonth", { amount: euro(offer.monthly) })}` : ""}</div>
        <div className="wr-lines">
          <button className="wr-line" onClick={sign}>{t("hall.door.buy")}</button>
          <button className="wr-line" onClick={onDone}>{t("locations-2.cancel")}</button>
        </div>
        {refused && <div className="wr-model hd-refused" role="alert">{t(refused)}</div>}
      </div>
    </div>
  );
}

const Plinth = () => <><rect className="hd-plinth" x="6" y="108" width="88" height="10" /><rect className="hd-spotline" x="14" y="30" width="72" height="78" rx="2" /></>;
const Leds = ({ on, x, y }: { on: boolean; x: number; y: number }) => <>{[0, 1, 2].map((i) => <rect key={i} className={`w-led${on ? " w-led-on" : ""}`} x={x + i * 6} y={y} width="3" height="2" />)}</>;

function Transformer({ built }: { built: boolean }) {
  return (
    <svg className="wp-art hd-art" viewBox="0 0 100 120" width="150" aria-hidden>
      {built ? <>
        <rect className="hd-plinth" x="6" y="108" width="88" height="10" />
        <rect className="hd-xf" x="14" y="38" width="72" height="70" rx="2" />
        <rect className="hd-xf-top" x="14" y="38" width="72" height="8" rx="2" />
        {[0, 1, 2].map((i) => <rect key={i} className="hd-fin" x={22 + i * 22} y="50" width="12" height="50" rx="1" />)}
        {[0, 1, 2].map((i) => <rect key={i} className="hd-insul" x={26 + i * 22} y="22" width="4" height="16" />)}
      </> : <Plinth />}
    </svg>
  );
}

function Cabinet({ built, tone }: { built: boolean; tone: string }) {
  return (
    <svg className="wp-art hd-art" viewBox="0 0 100 120" width="150" aria-hidden>
      {built ? <>
        <rect className="hd-plinth" x="6" y="108" width="88" height="10" />
        <rect className={`hd-cab ${tone}`} x="18" y="14" width="64" height="94" rx="2" />
        <rect className="hd-cab-door" x="24" y="20" width="52" height="82" />
        <rect className="w-lcd" x="30" y="28" width="24" height="10" rx="1" />
        <Leds on x={60} y={31} />
        {[0, 1, 2, 3].map((i) => <rect key={i} className="w-grille" x="30" y={50 + i * 10} width="40" height="3" rx="1" />)}
      </> : <Plinth />}
    </svg>
  );
}

// The generator stands in the yard, seen through the window.
function Yard({ built }: { built: boolean }) {
  return (
    <svg className="wp-art hd-art" viewBox="0 0 120 120" width="180" aria-hidden>
      <rect className="hd-frame" x="6" y="10" width="108" height="100" rx="2" />
      <rect className="hd-sky" x="12" y="16" width="96" height="60" />
      <rect className="hd-yard" x="12" y="76" width="96" height="28" />
      {built && <>
        <rect className="hd-gen" x="30" y="52" width="60" height="32" rx="2" />
        <rect className="hd-gen-top" x="30" y="52" width="60" height="7" rx="2" />
        <rect className="hd-pipe" x="78" y="40" width="5" height="14" />
        {[0, 1, 2, 3].map((i) => <rect key={i} className="w-grille" x="36" y={62 + i * 5} width="40" height="2" rx="1" />)}
      </>}
      <rect className="hd-mullion" x="58" y="16" width="4" height="88" />
    </svg>
  );
}

// The transformer room: the transformer and a spot for a second one, then feed B, the UPS and the generator.
export function XfmrRoom({ loc, title, onClose }: { loc: Location; title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt), [slip, setSlip] = useState<string | null>(null);
  const h = hallAt(game, loc.id);
  if (!h) return null;
  const { hall, p } = h, one = HALL.transformerKw[isHalle(p.buildingId) ? "halle" : "office"], main = hallKw(p) - hall.transformers * one;
  const up = (k: HallUpgrade): Offer => ({ key: k, name: t(`hall.upgrade.${k}`), price: HALL.upgrades[k].price, monthly: HALL.upgrades[k].monthly, run: () => attempt(buyHallUpgrade, loc.id, k) });
  const second: Offer = { key: "xfmr", name: t("hall.room.transformer"), price: HALL.transformer.price, monthly: HALL.transformer.monthly, run: () => attempt(buyTransformer, loc.id) };
  const spots: { id: string; label: string; art: ReactNode; offer?: Offer }[] = [
    { id: "t1", label: t("hall.door.kw", { kw: main }), art: <Transformer built /> },
    { id: "xfmr", label: t("hall.door.kw", { kw: one }), art: <Transformer built={hall.transformers > 0} />, offer: hall.transformers > 0 ? undefined : second },
    ...(["feedB", "ups", "generator"] as const).map((k) => ({
      id: k, label: t(`hall.upgrade.${k}`), art: k === "generator" ? <Yard built={hall.generator} /> : <Cabinet built={hall[k]} tone={`hd-${k}`} />, offer: hall[k] ? undefined : up(k),
    })),
  ];
  const open = spots.find((s) => s.id === slip)?.offer;
  return (
    <Slab title={title} onClose={onClose} data={{ "door-panel": "xfmr" }}>
      <div className="wp-scene hd-room">
        <div className="hd-row">{spots.map((s) => <Spot key={s.id} art={s.art} label={s.label} offer={s.offer} open={slip === s.id} onOpen={(k) => setSlip(k ? s.id : null)} />)}</div>
        {open && <Slip offer={open} onDone={() => setSlip(null)} />}
      </div>
    </Slab>
  );
}

// One carrier's fiber duct coming through the wall in its colour; a built one runs on to the patch rack.
function Duct({ hue, built }: { hue: number; built: boolean }) {
  const c = `oklch(0.66 0.15 ${hue})`, d = `oklch(0.42 0.1 ${hue})`;
  return (
    <svg className="wp-art hd-art" viewBox="0 0 100 150" width="110" aria-hidden>
      <rect className="hd-wall" x="0" y="0" width="100" height="150" />
      <rect x="38" y="0" width="24" height="96" rx="2" style={{ fill: built ? c : "oklch(0.5 0.01 250)" }} />
      <rect x="38" y="0" width="7" height="96" style={{ fill: built ? d : "oklch(0.4 0.01 250)" }} />
      <rect className="hd-collar" x="32" y="90" width="36" height="9" rx="1" />
      {built
        ? <><path d="M50,99 V128" style={{ stroke: c, strokeWidth: 3, fill: "none" }} /><rect className="hd-jack" x="40" y="128" width="20" height="12" rx="1" /><rect className="w-led w-led-on" x="46" y="132" width="3" height="2" /></>
        : <rect className="hd-cap" x="40" y="99" width="20" height="10" rx="1" />}
    </svg>
  );
}

// The meet-me room: one duct per carrier of the city. Without a meet-me area nothing can be built in.
export function MeetMeRoom({ loc, title, onClose }: { loc: Location; title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt), [slip, setSlip] = useState<string | null>(null);
  const h = hallAt(game, loc.id);
  if (!h) return null;
  const zone = h.hall.zones.some((z) => z.kind === "meetme");
  const offer = (id: string, name: string): Offer => ({ key: id, name, price: HALL.carrierFee, run: () => attempt(buildCarrier, loc.id, id) });
  const carriers = cityCarriers(loc.city), open = carriers.find((c) => c.id === slip);
  return (
    <Slab title={title} onClose={onClose} data={{ "door-panel": "meetme" }}>
      <div className="wp-scene hd-room">
        <div className="hd-row">
          {carriers.map((c) => {
            const built = h.hall.carriers.includes(c.id);
            return (
              <div key={c.id} className="wp-unit hd-spot">
                <Duct hue={hueOf(c.id)} built={built} />
                {built || !zone
                  ? <span className="wp-label"><b>{c.name}</b>{!built && <span>{t("hall.door.noMeetMe")}</span>}</span>
                  : <button onClick={() => setSlip(slip === c.id ? null : c.id)} aria-expanded={slip === c.id}><span className="wp-label"><b>{c.name}</b><span className="num">{euro(HALL.carrierFee)}</span></span></button>}
              </div>
            );
          })}
        </div>
        {open && <Slip offer={offer(open.id, open.name)} onDone={() => setSlip(null)} />}
      </div>
    </Slab>
  );
}
