import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { euroPrice } from "../../../../../sim/00-core/money";
import { tiersOf } from "../../../../../sim/10-catalog/licence-tiers";
import type { LicenseKind } from "../../../../../sim/10-catalog/server-os";
import type { GameState, Licence } from "../../../../../sim/50-state";
import { keyExpired, productOf } from "../../../../../sim/60-infra/licence";
import { cartOf, keysOf, lineOffer, offers, orderKeys, upgradeOffers, type CartLine, type Offer } from "../../../../../sim/80-business/vendor-shop";
import { addToCart, cancelLicence, checkout, removeFromCart, type LicencePayment } from "../../../../../sim/90-actions/vendor-shop";
import { cardReady, cardSpent } from "../../../../../sim/46-finance/bank";
import { useStore } from "../../../../store";
import { day } from "../../../hw";
import "./shop.css";

// docs/design/plans/software-licences.md, lanes vendor-shop and my-account: the product page, cart and My account every
// vendor site lays out in its own look; btn is the site's button class.
type ShopProps = { btn: string };

const productName = (id: string) => productOf(id)?.name ?? id;
const editionName = (product: string, edition: string | null) => tiersOf(product).find((x) => x.id === edition)?.name ?? "";
const lineName = (product: string, edition: string | null, from?: string) =>
  [productName(product), editionName(product, edition), from ? t("vendor-shop.upgradeFrom", { from }) : ""].filter(Boolean).join(" ");
const UNIT: Record<LicenseKind, string> = { once: "vendor-shop.once", server: "vendor-shop.perServer", core: "vendor-shop.perCore", account: "vendor-shop.perAccount", gameserver: "vendor-shop.perGameserver", free: "vendor-shop.once" };
const priceOf = (o: Offer) => t(`${UNIT[o.kind]}${o.period === "year" ? "Year" : ""}`, { fee: euroPrice(o.fee) });

export const cartCount = (s: GameState, host: string): number => cartOf(s, host).reduce((n, l) => n + l.qty, 0);

export function Editions({ product, btn }: ShopProps & { product: string }) {
  const game = useStore((s) => s.game), hour = game.hour, act = useStore((s) => s.act);
  const caps = tiersOf(product);
  return (
    <table className="shop-table">
      <thead><tr><th>{t("vendor-shop.edition")}</th>{caps.length > 0 && <th>{t("vendor-shop.accounts")}</th>}<th>{t("vendor-shop.price")}</th><th /></tr></thead>
      <tbody>{offers(product, hour).map((o) => {
        const cap = caps.find((x) => x.id === o.edition)?.cap;
        return (
          <tr key={o.edition ?? product}>
            <td>{lineName(product, o.edition)}</td>
            {caps.length > 0 && <td className="num">{cap == null ? t("vendor-shop.unlimited") : cap}</td>}
            <td className="num">{priceOf(o)}</td>
            <td><button type="button" className={btn} onClick={() => act(addToCart, product, o.edition)}>{t("vendor-shop.addToCart")}</button></td>
          </tr>
        );
      })}
      {upgradeOffers(game, product).map((o) => (
        <tr key={`up.${o.from}`}>
          <td>{lineName(product, null, o.from)}</td>
          {caps.length > 0 && <td />}
          <td className="num">{priceOf({ edition: null, fee: o.fee, kind: "once" })}</td>
          <td><button type="button" className={btn} onClick={() => act(addToCart, product, null, o.from)}>{t("vendor-shop.addToCart")}</button></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export function Cart({ host, btn, account }: ShopProps & { host: string; account: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [order, setOrder] = useState<string | null>(null);
  const [pick, setPick] = useState<LicencePayment>("transfer");
  const lines = cartOf(game, host);
  if (!lines.length) {
    if (!order) return <p>{t("vendor-shop.empty")}</p>;
    return <p>{t("vendor-shop.placed", { order })} <a href="#account" onClick={(e) => { e.preventDefault(); account(); }}>{t("vendor-shop.myAccount")}</a></p>;
  }
  const total = lines.reduce((n, l) => n + (lineOffer(game, l)?.fee ?? 0) * l.qty, 0);
  const card = cardReady(game) && cardSpent(game) + total <= game.bank!.card!.limit, pay = card ? pick : "transfer";
  return (
    <>
      <table className="shop-table">
        <thead><tr><th>{t("vendor-shop.product")}</th><th>{t("vendor-shop.qty")}</th><th>{t("vendor-shop.price")}</th><th /></tr></thead>
        <tbody>{lines.map((l: CartLine) => {
          const o = lineOffer(game, l);
          return (
            <tr key={`${l.product}.${l.edition}.${l.from ?? ""}`}>
              <td>{lineName(l.product, l.edition, l.from)}</td><td className="num">{l.qty}</td><td className="num">{o ? priceOf(o) : ""}</td>
              <td><button type="button" className={btn} onClick={() => act(removeFromCart, l.product, l.edition, l.from)}>{t("vendor-shop.remove")}</button></td>
            </tr>
          );
        })}</tbody>
        <tfoot><tr><th>{t("vendor-shop.total")}</th><td /><td className="num">{euroPrice(total)}</td><td /></tr></tfoot>
      </table>
      <fieldset>
        <legend>{t("shop.payment")}</legend>
        <label><input type="radio" name="pay" checked={pay === "card"} disabled={!card} onChange={() => setPick("card")} /> {t("bank.shop.card")}</label>
        <label><input type="radio" name="pay" checked={pay === "transfer"} onChange={() => setPick("transfer")} /> {t("bank.shop.prepay")}</label>
      </fieldset>
      <p><button type="button" className={btn} onClick={() => { const r = act(checkout, host, pay); if (r.ok) setOrder(r.id ?? null); }}>{t("vendor-shop.checkout")}</button></p>
    </>
  );
}

function machineName(s: GameState, id: string | null): string {
  if (id === null) return t("vendor-shop.unassigned");
  const d = s.devices.find((x) => x.id === id);
  return d ? d.name : s.workloads.find((x) => x.id === id)?.hostname ?? id;
}

function status(s: GameState, k: Licence): string {
  if (keyExpired(s, k)) return t("vendor-shop.expired");
  if (k.covers.kind === "version") return t("vendor-shop.version", { major: k.covers.major });
  return k.renewsAt === null ? t("vendor-shop.endsOn", { date: day(k.covers.until) }) : t("vendor-shop.renewsOn", { date: day(k.renewsAt) });
}

export function Account({ host, btn }: ShopProps & { host: string }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const keys = keysOf(game, host);
  if (!keys.length) return <p>{t("vendor-shop.noLicences")}</p>;
  return (
    <table className="shop-table">
      <thead><tr><th>{t("vendor-shop.product")}</th><th>{t("vendor-shop.edition")}</th><th>{t("vendor-shop.key")}</th><th>{t("vendor-shop.machine")}</th><th>{t("vendor-shop.status")}</th><th /></tr></thead>
      <tbody>{keys.map((k) => (
        <tr key={k.id}>
          <td>{productName(k.product)}</td><td>{editionName(k.product, k.edition)}</td><td className="shop-key">{k.key}</td>
          <td>{machineName(game, k.machineId)}</td><td>{status(game, k)}</td>
          <td>{k.covers.kind === "term" && k.renewsAt !== null && !keyExpired(game, k) && <button type="button" className={btn} onClick={() => act(cancelLicence, k.id)}>{t("vendor-shop.cancel")}</button>}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

// The keys an order email lists.
export const OrderKeys = ({ game, order }: { game: GameState; order: string }) => (
  <table className="shop-table">
    <thead><tr><th>{t("vendor-shop.product")}</th><th>{t("vendor-shop.key")}</th></tr></thead>
    <tbody>{orderKeys(game, order).map((k) => <tr key={k.id}><td>{lineName(k.product, k.edition)}</td><td className="shop-key">{k.key}</td></tr>)}</tbody>
  </table>
);
