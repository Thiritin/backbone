import { useState } from "react";
import { t } from "../../../../i18n/en";
import { euroPrice } from "../../../../sim/00-core/money";
import { nowMinutes } from "../../../../sim/00-core/time";
import { componentById, type PanelComponent } from "../../../../sim/10-catalog/panel-components";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { componentsFor, installingOn, stackOf } from "../../../../sim/60-infra/panel-services";
import { installComponent, removeModule } from "../../../../sim/90-actions/panel-ops";
import { usePageAct } from "../pageAct";

const SLOTS = ["web", "mail", "ftp"] as const;

// docs/design/plans/panel-ops.md, Components: Pleskit Add/Remove Components, cPanic Install Software, DirectAdmen Custombuild, FreePanel Software Packages.
export function ComponentsPage({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), stack = stackOf(game, c), offered = componentsFor(game, c), job = installingOn(game, c.id);
  const modules = offered.filter((x) => x.slot === "module");
  return (
    <>
      {job && <p className="cx-acts"><span className="cx-state">{t("panel-services.installing", { name: componentById(job.id)?.name ?? job.id, minutes: job.until - nowMinutes(game) })}</span></p>}
      <table className="cx-table">
        <thead><tr><th>{t("panel-services.component")}</th><th>{t("panel-services.installed")}</th><th>{t("panel-services.available")}</th><th /></tr></thead>
        <tbody>{SLOTS.map((slot) => (
          <SlotRow key={slot} slot={slot} installed={componentById(stack[slot])?.name ?? ""} busy={!!job}
            others={offered.filter((x) => x.slot === slot && x.id !== stack[slot])} install={(id) => act(installComponent, c.id, id)} />
        ))}</tbody>
      </table>
      <table className="cx-table">
        <thead><tr><th>{t("panel-services.module")}</th><th>{t("panel-services.fee")}</th><th>{t("readouts.status")}</th><th /></tr></thead>
        <tbody>{modules.map((x) => {
          const on = stack.modules.includes(x.id);
          return (
            <tr key={x.id}>
              <td><b>{x.name}</b></td>
              <td className="num">{x.fee ? t("panel-services.perMonth", { fee: euroPrice(x.fee) }) : t("panel-services.free")}</td>
              <td>{on && <span className="cx-state ok">{t("panel-services.installed")}</span>}</td>
              <td>{on
                ? <button className="cx-btn" onClick={() => act(removeModule, c.id, x.id)}>{t("web.ea.remove")}</button>
                : <button className="cx-btn" disabled={!!job} onClick={() => act(installComponent, c.id, x.id)}>{t("web.ea.install")}</button>}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </>
  );
}

function SlotRow({ slot, installed, others, busy, install }: { slot: string; installed: string; others: PanelComponent[]; busy: boolean; install: (id: string) => void }) {
  const [pick, setPick] = useState(""), chosen = others.some((x) => x.id === pick) ? pick : others[0]?.id ?? "";
  const label = t(`panel-services.slot.${slot}`);
  return (
    <tr>
      <td>{label}</td>
      <td><b>{installed}</b></td>
      <td>{others.length > 0 && (
        <select aria-label={label} value={chosen} onChange={(e) => setPick(e.target.value)}>
          {others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}</td>
      <td>{others.length > 0 && <button className="cx-btn" disabled={busy} onClick={() => install(chosen)}>{t("web.ea.install")}</button>}</td>
    </tr>
  );
}
