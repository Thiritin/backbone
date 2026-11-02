import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { shopById, type ShopId } from "../../../../../sim/10-catalog/shops";
import { versionAt } from "../../../../../sim/10-catalog/software-versions";
import type { GameState } from "../../../../../sim/50-state";
import { isLicensed } from "../../../../../sim/60-infra/licence";
import { EMAIL_LOGIN, shopUrl } from "../../../../../sim/60-infra/shop-files";
import { webspaceOf } from "../../../../../sim/60-infra/webspace";
import { appInstallerShops, installShopApp, type AppInstallForm } from "../../../../../sim/90-actions/shop-setup";
import { useStore } from "../../../../store";
import { isSelfDesk, type SelfDeskId } from "../../../../../sim/10-catalog/archives";
import { deskById } from "../../../../../sim/10-catalog/desks";
import { deskUrl } from "../../../../../sim/60-infra/desk-files";
import { appInstallerDesks, installDeskApp, type DeskAppForm } from "../../../../../sim/90-actions/desk-setup";

// Softaculus in the customer side: the billing scripts it lists that year, and one install form that creates the folder,
// files, database and admin account itself (web-hosting.md 4.6).
export function Softaculus({ game, workloadId }: { game: GameState; workloadId: string }) {
  const attempt = useStore((s) => s.attempt), ws = webspaceOf(game, workloadId), [pick, setPick] = useState<ShopId | SelfDeskId | null>(null);
  const [f, setF] = useState<AppInstallForm & Pick<DeskAppForm, "helpdesk" | "deskEmail">>({ domain: ws?.domain ?? "", dir: "", key: "", first: "", last: "", email: "", user: "admin", pass: "", helpdesk: "", deskEmail: "" });
  const [error, setError] = useState<string | null>(null), [done, setDone] = useState<string | null>(null);
  if (!ws) return null;
  const year = yearOf(game.hour), shops = appInstallerShops(year), desks = appInstallerDesks(year);
  const desk = pick && isSelfDesk(pick) ? pick : null, shop = pick && !desk ? (pick as ShopId) : null;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const choose = (id: ShopId | SelfDeskId) => {
    setPick(id); setError(null); setDone(null);
    setF({ ...f, dir: isSelfDesk(id) ? "support" : shopById(id).name.toLowerCase().replace(/[^a-z]/g, "") });
  };
  const install = () => {
    const r = desk ? attempt(installDeskApp, workloadId, desk, f) : attempt(installShopApp, workloadId, shop!, { ...f, key: f.key || undefined });
    setError(r.ok ? null : t(r.error, r.params));
    const g = useStore.getState().game;
    if (r.ok) setDone((desk ? deskUrl(g) : shopUrl(g)) ?? f.domain);
  };
  const tile = (id: ShopId | SelfDeskId, name: string) => (
    <button key={id} className="cx-tile" aria-pressed={pick === id} onClick={() => choose(id)}><b>{name}</b><span className="num">{versionAt(id, game.hour).version}</span></button>
  );
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="cx-field">{label}<input type={type} value={f[k] ?? ""} autoComplete="off" onChange={set(k)} /></label>
  );
  return (
    <div className="cp-softaculus">
      <h2>{t("shop-setup.app.title")}</h2>
      <h3>{t("shop-setup.app.category")}</h3>
      <div className="cp-icons">{shops.map((id) => tile(id, shopById(id).name))}</div>
      {desks.length > 0 && <>
        <h3>{t("desk-setup.app.category")}</h3>
        <div className="cp-icons">{desks.map((id) => tile(id, deskById(id)!.name))}</div>
      </>}
      {pick && (done ? <p className="cx-banner" role="status">{t("shop-setup.app.done", { url: done })}</p> : (
        <form className="cx-form" onSubmit={(e) => { e.preventDefault(); install(); }}>
          <label className="cx-field">{t("shop-setup.app.domain")}
            <select value={f.domain} onChange={set("domain")}>
              {Object.values(ws.domains).filter((d) => d.kind !== "parked").map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </label>
          {field("dir", t("shop-setup.app.dir"))}
          {shop && isLicensed(shop) && field("key", t("shop-setup.key"))}
          {desk && <>
            <h4 className="cx-h">{t("desk-setup.app.site")}</h4>
            {field("helpdesk", t("desk-setup.ost.helpdesk"))}
            {field("deskEmail", t("desk-setup.ost.deskEmail"), "email")}
          </>}
          <h4 className="cx-h">{t("shop-setup.app.settings")}</h4>
          {(desk || !EMAIL_LOGIN.includes(shop!)) && field("user", t("shop-setup.user"))}
          {field("pass", t("shop-setup.pass"), "password")}
          {field("email", t("shop-setup.email"), "email")}
          {field("first", t("shop-setup.first"))}
          {field("last", t("shop-setup.last"))}
          {error && <p className="cx-banner bad" role="alert">{error}</p>}
          <button type="submit" className="cx-btn primary">{t("shop-setup.app.install")}</button>
        </form>
      ))}
    </div>
  );
}
