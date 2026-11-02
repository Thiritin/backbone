import { useState } from "react";
import { t } from "../../../../i18n/en";
import { euroPrice } from "../../../../sim/00-core/money";
import { formatClock } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { bookedOn, oversellRatio, oversold, physicalOf } from "../../../../sim/60-infra/oversell";
import { workloadUse } from "../../../../sim/60-infra/usage";
import { familyOf } from "../../../../sim/60-infra/vulns";
import { CHANNELS, channelOf } from "../../../../sim/60-infra/channel";
import { setChannel } from "../../../../sim/90-actions/software";
import { setOversell } from "../../../../sim/90-actions/oversell";
import { tiersOf } from "../../../../sim/10-catalog/licence-tiers";
import { accountsOn, isLicensed, licenceExpired, panelMachine, panelStatus, tierOf, tiersOnSale, trialOf } from "../../../../sim/60-infra/licence";
import { setLicenceTier } from "../../../../sim/90-actions/licence";
import { installShop } from "../../../../sim/90-actions/shop";
import { shopById, SHOPS, type ShopId } from "../../../../sim/10-catalog/shops";
import { shopOnSale } from "../../../../sim/10-catalog/shop-licences";
import { deskById, deskReady, DESKS, type DeskId } from "../../../../sim/10-catalog/desks";
import { installDesk, removeDesk } from "../../../../sim/90-actions/desk-install";
import { ram } from "../../hw";
import { Facts, type Fact } from "./PanelBase";
import { usePageAct } from "../pageAct";

const num = (n: number) => `${+n.toFixed(2)}`;

// Booked and used capacity of a panel host with the oversell cap; Pterodaktyl takes the cap as an overallocation percentage.
export function Oversell({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), percent = familyOf(c) === "pterodaktyl";
  const shown = (cap: number | null | undefined) => (cap == null ? "" : String(percent ? Math.round(cap * 100) : cap));
  const [value, setValue] = useState(shown(c.oversell));
  const mine = game.workloads.filter((w) => w.clusterId === c.id), ids = new Set(mine.map((w) => w.serviceId));
  const phys = physicalOf(game, c), booked = bookedOn(game, c), ratio = oversellRatio(game, c);
  const used = mine.reduce((a, w) => a + workloadUse(game, w).vcpu, 0);
  const slow = Math.max(-1, ...game.services.filter((v) => ids.has(v.id)).map((v) => v.slowedAt ?? -1));
  const facts: Fact[] = [
    { label: t("host.accounts"), value: String(mine.length), num: true },
    { label: t("host.vcpu"), value: t("host.vcpuValue", { booked: num(booked.vcpu), used: num(used), physical: num(phys.vcpu) }), num: true },
    { label: t("host.ram"), value: t("host.ramValue", { booked: ram(+booked.ramGb.toFixed(1)), physical: ram(+phys.ramGb.toFixed(1)) }), num: true },
    { label: t("host.ratio"), value: `${num(ratio.cpu)} : 1`, num: true },
    { label: t("host.lastSlowdown"), value: slow < 0 ? t("host.none") : formatClock(slow), num: true },
  ];
  const parsed = value.trim() === "" ? null : Number(value) / (percent ? 100 : 1);
  return (
    <>
      <h4 className="cx-h">{t("host.oversell")}</h4>
      <Facts facts={facts} />
      <div className="cx-inline">
        <label className="cx-field">{t(percent ? "host.overallocate" : "host.cap")}
          <input type="number" min={percent ? 0 : 0.5} step={percent ? 10 : 0.5} value={value} placeholder={t("host.noCap")} onChange={(e) => setValue(e.target.value)} />
        </label>
        <button className="cx-btn primary" onClick={() => act(setOversell, c.id, parsed)}>{t("host.set")}</button>
      </div>
    </>
  );
}

// The release channel the host updates from.
export function ChannelPicker({ c }: { c: Cluster }) {
  const act = usePageAct(), now = channelOf(c);
  return (
    <>
      <h4 className="cx-h">{t("host.channel")}</h4>
      <div className="cx-tools">
        {CHANNELS.map((x) => <button key={x} className="cx-chip" aria-pressed={x === now} onClick={() => act(setChannel, c.id, x)}>{t(`host.channel.${x}`)}</button>)}
      </div>
    </>
  );
}

// The red notice a console shows while new accounts are refused.
export const LicenceBanner = ({ game, c }: { game: GameState; c: Cluster }) =>
  tiersOf(c.panel).length > 0 && licenceExpired(game, c) ? <p className="cx-banner bad" role="alert">{t("error.licenceExpired")}</p> : null;

// Edition, accounts against the cap, expiry and the editions to switch to.
export function LicenceTiers({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), tier = tierOf(game, c);
  if (!tier) return null;
  const status = panelStatus(game, c), machine = panelMachine(c), trial = machine && c.panel ? trialOf(game, machine, c.panel) : undefined;
  const fee = (x: typeof tier) => t(x.kind === "account" ? "host.perAccount" : "host.perMonth", { fee: euroPrice(x.fee) });
  const facts: Fact[] = [
    { label: t("host.edition"), value: tier.name },
    { label: t("host.accounts"), value: tier.cap === null ? t("host.unlimited", { n: accountsOn(game, c) }) : t("host.of", { n: accountsOn(game, c), cap: tier.cap }), num: true },
    { label: t("host.expires"), value: status === "lapsed" ? t("host.lapsed") : status !== "active" && trial ? t("host.trialUntil", { date: formatClock(trial.until) }) : t("host.never"), num: true },
  ];
  return (
    <>
      <LicenceBanner game={game} c={c} />
      <Facts facts={facts} />
      <div className="cx-tools">
        {tiersOf(c.panel).filter((x) => x.id === tier.id || tiersOnSale(c.panel, game.hour).includes(x)).map((x) => <button key={x.id} className="cx-chip" aria-pressed={x.id === tier.id && !licenceExpired(game, c)} onClick={() => act(setLicenceTier, c.id, x.id)}>{`${x.name} · ${fee(x)}`}</button>)}
      </div>
    </>
  );
}

// The shop system in a web space of a panel host: the release it runs here, and any shop on sale or keyed to install, with a key or on its trial.
export function ShopInstall({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), [code, setCode] = useState("");
  const shops = SHOPS.filter((v) => shopOnSale(v.id, game.hour) || game.licenses.some((k) => k.product === v.id));
  const [pick, setPick] = useState<ShopId | null>(null), id = pick ?? game.shop.variant ?? shops[0]?.id;
  if (c.kind !== "panel" || !game.unlocks.includes("shops") || !id) return null;
  const here = game.shop.install?.clusterId === c.id ? game.shop.install : null;
  return (
    <>
      <h4 className="cx-h">{t("host.shop")}</h4>
      {here && game.shop.variant && <Facts facts={[{ label: shopById(game.shop.variant).name, value: here.version, num: true }]} />}
      <div className="cx-inline">
        <select aria-label={t("host.shop")} value={id} onChange={(e) => setPick(e.target.value as ShopId)}>
          {shops.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        {isLicensed(id) && <label className="cx-field">{t("shop-admin.key")}<input value={code} autoComplete="off" onChange={(e) => setCode(e.target.value)} /></label>}
        <button className="cx-btn primary" onClick={() => act(installShop, c.id, id, code.trim() || undefined).ok && setCode("")}>{t("host.installShop", { name: shopById(id).name })}</button>
      </div>
    </>
  );
}

// A self-hosted desk in a web space of a panel host, until the host's app catalogue installs it.
export function DeskInstall({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), desks = DESKS.filter((d) => d.hosting === "self" && deskReady(game, d.id));
  const [pick, setPick] = useState<DeskId | null>(null), id = pick ?? desks.at(-1)?.id;
  if (c.kind !== "panel" || !id) return null;
  const h = game.desk?.hosting, here = h?.kind === "self" && h.clusterId === c.id ? h : null;
  return (
    <>
      <h4 className="cx-h">{t("desk-sites.host.title")}</h4>
      {here && <Facts facts={[{ label: deskById(game.desk!.id)!.name, value: here.version, num: true }]} />}
      <div className="cx-inline">
        <select aria-label={t("desk-sites.host.title")} value={id} onChange={(e) => setPick(e.target.value as DeskId)}>
          {desks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="cx-btn primary" onClick={() => act(installDesk, c.id, id)}>{t("desk-sites.host.install", { name: deskById(id)!.name })}</button>
        {here && <button className="cx-btn" onClick={() => act(removeDesk)}>{t("desk-sites.host.remove")}</button>}
      </div>
    </>
  );
}

// What the software page of a panel or game host adds under its actions.
export function HostSettings({ game, c }: { game: GameState; c: Cluster }) {
  return oversold(c) ? <div className="cx-host-settings"><LicenceBanner game={game} c={c} />{c.kind === "panel" && <ChannelPicker c={c} />}<Oversell game={game} c={c} /><ShopInstall game={game} c={c} /><DeskInstall game={game} c={c} /></div> : null;
}
