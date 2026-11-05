import { PBtn } from "./ui";
import { useState } from "react";
import { PayButton } from "../../shared/PayButton";
import { t } from "../../../../../../i18n/en";
import { euroPrice } from "../../../../../../sim/00-core/money";
import { shopLicence } from "../../../../../../sim/10-catalog/shop-licences";
import { shopById, type ShopId } from "../../../../../../sim/10-catalog/shops";
import { nextMajor } from "../../../../../../sim/10-catalog/software-versions";
import type { GameState } from "../../../../../../sim/50-state";
import { assignedKey, covers, licenceStatus, SHOP_MACHINE, trialOf } from "../../../../../../sim/60-infra/licence";
import { supportOn } from "../../../../../../sim/60-infra/lifecycle";
import { shopCount, shopUpdate, shopUpdatesFee } from "../../../../../../sim/80-business/shop";
import { hostOf, upgradeOffer, vendorName } from "../../../../../../sim/80-business/vendor-shop";
import { shopBlock, shopTier } from "../../../../../../sim/80-business/website";
import { activateLicence, removeLicence } from "../../../../../../sim/90-actions/licence";
import { renewShopUpdates, updateShop, upgradeFee, upgradeShop } from "../../../../../../sim/90-actions/shop";
import { formatDay } from "../../../../billing/format";
import { useFieldAct, usePageAct } from "../../../pageAct";

// docs/design/shop-surfaces.md: the licence and updates screens, the closed store and the version footer every shop
// system wraps in its own look.
type Props = { game: GameState; browse?: (url: string) => void };

// Whether the shop's licence ran out, so its admin shows only the licence screen.
export const licenceLocked = (game: GameState): boolean =>
  !!game.shop.variant && ["ended", "lapsed", "unlicensed"].includes(licenceStatus(game, SHOP_MACHINE, game.shop.variant) ?? "");

export function LicenceScreen({ game }: Props) {
  const [act, error] = useFieldAct(), [code, setCode] = useState("");
  const id = game.shop.variant!, k = assignedKey(game, SHOP_MACHINE, id), status = licenceStatus(game, SHOP_MACHINE, id);
  const tier = shopTier(game), caps = shopLicence(id).caps, trial = trialOf(game, SHOP_MACHINE, id);
  const edition = tier?.name ?? (k ? t(k.kind === "once" ? "shop-admin.owned" : "shop-admin.leased") : status === null ? t("shop-admin.free") : t("shop-admin.trial"));
  const state = status === "trial" && trial ? t("host.trialUntil", { date: formatDay(trial.until) }) : status ? t(`shop-admin.licence_${status}`) : t("shop-admin.licence_active");
  const save = () => { if (act(activateLicence, SHOP_MACHINE, id, code).ok) setCode(""); };
  return (
    <div className="pt-screen pt-licence">
      <dl className="pt-fields">
        <dt>{t("host.edition")}</dt><dd>{edition}</dd>
        <dt>{t("shop-admin.status")}</dt><dd>{state}</dd>
        {k && <><dt>{t("shop-admin.key")}</dt><dd><span className="num">{k.key}</span> <PBtn type="button" onClick={() => act(removeLicence, SHOP_MACHINE, id)}>{t("host.removeKey")}</PBtn></dd></>}
        {caps && <><dt>{t(caps === "servers" ? "shop-admin.capServers" : "shop-admin.capClients")}</dt>
          <dd className="num">{tier?.cap == null ? t("host.unlimited", { n: shopCount(game) }) : t("host.of", { n: shopCount(game), cap: tier.cap })}</dd></>}
        {k?.updatesUntil !== undefined && <><dt>{t("shop-admin.updatesUntil")}</dt><dd className="num">{formatDay(k.updatesUntil)}</dd></>}
      </dl>
      {status !== null && !k && (
        <form className="pt-key" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label>{t("shop-admin.key")}<input name="key" value={code} autoComplete="off" onChange={(e) => setCode(e.target.value)} /></label>
          <PBtn type="submit" primary>{t("shop-admin.saveKey")}</PBtn>
          {error && <p className="pt-error" role="alert">{t(error)}</p>}
        </form>
      )}
    </div>
  );
}

export function UpdatesScreen({ game, browse }: Props) {
  const act = usePageAct(), id = game.shop.variant!, version = game.shop.install?.version ?? "";
  const k = assignedKey(game, SHOP_MACHINE, id), update = shopUpdate(game), next = nextMajor(id, version, game.hour);
  const fee = k?.updatesUntil !== undefined ? shopUpdatesFee(game, k) : undefined, host = hostOf(id);
  const price = next && k && !covers(k, next.version) && k.covers.kind === "version" ? upgradeOffer(game, id, k.covers.major)?.fee : undefined;
  // Keys and updates are bought in My account on the vendor's site; a vendor without a site sells them here. An upgrade the
  // held key covers runs here.
  const account = host ? () => browse?.(`${host}/account`) : undefined;
  return (
    <div className="pt-screen pt-updates">
      {supportOn(game, SHOP_MACHINE, id) === "securityEnded" && <p className="pt-error" role="alert">{t("shop-admin.securityEnded")}</p>}
      <dl className="pt-fields">
        <dt>{t("shop-admin.installed")}</dt><dd className="num">{version}</dd>
        <dt>{t("shop-admin.available")}</dt>
        <dd><span className="num">{update?.version ?? t("shop-admin.none")}</span> <PBtn type="button" disabled={!update} onClick={() => act(updateShop)}>{t("shop-admin.installUpdate")}</PBtn></dd>
        {k?.updatesUntil !== undefined && <><dt>{t("shop-admin.updatesUntil")}</dt>
          <dd><span className="num">{formatDay(k.updatesUntil)}</span> {fee !== undefined && (account
            ? <PBtn type="button" onClick={account}>{t("vendor-shop.myAccount")}</PBtn>
            : <PayButton className="pt-btn" supplier="shopVendor" name={vendorName(id)} amount={fee ?? 0} run={(m) => act(renewShopUpdates, m)}>{t("shop-admin.renewUpdates", { fee: euroPrice(fee) })}</PayButton>)}</dd></>}
        {next && <><dt>{t("shop-admin.nextMajor")}</dt>
          <dd><span className="num">{next.version}</span> {price === undefined
            ? <PayButton className="pt-btn" supplier="shopVendor" name={vendorName(id)} amount={upgradeFee(game) ?? 0} run={(m) => act(upgradeShop, m)}>{t("shop-admin.upgrade")}</PayButton>
            : account
              ? <PBtn type="button" onClick={account}>{t("vendor-shop.myAccount")}</PBtn>
              : <PayButton className="pt-btn" supplier="shopVendor" name={vendorName(id)} amount={upgradeFee(game) ?? 0} run={(m) => act(upgradeShop, m)}>{t("shop-admin.upgradeFor", { fee: euroPrice(price) })}</PayButton>}</dd></>}
      </dl>
    </div>
  );
}

// The store and client area while the shop takes no orders.
export function NotTakingOrders({ game }: Props) {
  const why = shopBlock(game);
  return (
    <div className="pt-screen pt-closed">
      <h2>{t("shop-admin.closed")}</h2>
      {why && <p>{t(why)}</p>}
    </div>
  );
}

export const VersionFooter = ({ game, variant }: { game: GameState; variant: ShopId }) =>
  <footer className="pt-version">{t("shop-admin.footer", { name: shopById(variant).name, version: game.shop.install?.version ?? "" })}</footer>;
