import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { nextMonthStart } from "../../../../../../sim/00-core/time";
import { domainOf, nameServers } from "../../../../../../sim/30-customers/registry";
import { accessParams } from "../../../../../../sim/40-support/replies";
import { moduleRuns, serviceCluster, serviceStatus } from "../../../../../../sim/80-business/shop-orders";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { suspendService, terminateService, unsuspendService } from "../../../../../../sim/90-actions/holds";
import { packagesOf } from "../../../../../../sim/80-business/packages";
import { changePackage } from "../../../../../../sim/90-actions/packages";
import { changeServicePassword, resendWelcome } from "../../../../../../sim/90-actions/shop-orders";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import { PRODUCT } from "../../../../support/labels";
import type { ScreenProps } from "./nav";
import { CYCLE_LABEL } from "./ProductEdit";
import { commandLabel, serviceStatusLabel, type Command } from "./terms";

// A client's service: product, billing, server and the module commands, with the access data behind a reveal button.
export function ServiceDetail({ game, go, id }: ScreenProps & { id: string }) {
  const act = useStore((s) => s.act);
  const [shown, setShown] = useState(false), [failed, setFailed] = useState<ActionResult | null>(null), [pkg, setPkg] = useState("");
  const v = game.services.find((x) => x.id === id);
  if (!v) return null;
  const variant = game.shop.variant, status = serviceStatus(game, v), cluster = serviceCluster(game, v), live = v.endedAt === null;
  const access = accessParams(game, v), domain = v.domain ? domainOf(game, v.domain) : undefined, ns = domain ? nameServers(game, domain) : null;
  const packages = (cluster ? packagesOf(cluster) : []).filter((p) => p.product === v.product && p.name !== v.pkg);
  const run = (r: ActionResult) => setFailed(r.ok ? null : r);
  const commands: [Command, boolean, () => ActionResult][] = [
    ["suspend", status === "active", () => act(suspendService, v.id)],
    ["unsuspend", status === "suspended", () => act(unsuspendService, v.id)],
    ["terminate", live && v.endsAt === undefined, () => act(terminateService, v.id, "notice", null)],
    ["changePassword", live, () => act(changeServicePassword, v.id)],
  ];
  const module = moduleRuns(game, v);
  const field = (label: string, value: string) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>;
  return (
    <div className="pt-screen">
      <dl className="pt-fields">
        <div><dt>{t("shop-admin.client")}</dt><dd><a href="#" onClick={(e) => { e.preventDefault(); go({ name: "client", id: v.customerId }); }}>{game.customers.find((c) => c.id === v.customerId)?.name}</a></dd></div>
        {field(t("shop-admin.product"), `${PRODUCT[v.product]}: ${v.label}`)}
        {field(t("shop-store.cycle"), CYCLE_LABEL[v.cycle ?? "monthly"])}
        {field(t("shop-admin.price"), euroCents(v.price * 730))}
        {live && field(t("shop-terms.nextDue"), formatDay(v.termEnd ?? nextMonthStart(game.hour)))}
        {field(t("shop-terms.server"), cluster?.name ?? "")}
        {field(t("shop-terms.package"), v.pkg ?? t("shop-terms.custom"))}
        {field(t("shop-admin.status"), serviceStatusLabel(variant, status))}
      </dl>
      <h3>{t("shop-terms.access")}</h3>
      <dl className="pt-fields">
        {field(t("shop-terms.username"), access.user)}
        <div><dt>{t("shop-terms.password")}</dt><dd>{shown ? access.password : "••••••••"} <button className="btn" onClick={() => setShown(!shown)}>{t(shown ? "shop-terms.hide" : "shop-terms.reveal")}</button></dd></div>
        {field(t("shop-terms.address"), access.address)}
        {ns && field(t("shop-terms.nameservers"), ns.join(", "))}
      </dl>
      {failed && !failed.ok && <p className="pt-error" role="alert">{t(failed.error, failed.params)}</p>}
      <div className="pt-form">
        {commands.map(([c, on, fn]) => { const label = commandLabel(variant, c); return label && <button key={c} className="btn" disabled={!module || !on} onClick={() => run(fn())}>{label}</button>; })}
        <button className="btn" disabled={!live} onClick={() => run(act(resendWelcome, v.id))}>{t("shop-mail.resendWelcome")}</button>
      </div>
      {commandLabel(variant, "changePackage") && packages.length > 0 && (
        <div className="pt-form">
          <select className="field" aria-label={t("shop-terms.package")} value={pkg || packages[0].name} onChange={(e) => setPkg(e.target.value)}>
            {packages.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button className="btn" disabled={!module || !live} onClick={() => run(act(changePackage, v.id, pkg || packages[0].name))}>{commandLabel(variant, "changePackage")}</button>
        </div>
      )}
    </div>
  );
}
