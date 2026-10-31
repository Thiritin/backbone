import { useState } from "react";
import { t } from "../../../../i18n/en";
import { formatClock } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { bookedOn, oversellRatio, oversold, physicalOf } from "../../../../sim/60-infra/oversell";
import { workloadUse } from "../../../../sim/60-infra/usage";
import { familyOf } from "../../../../sim/60-infra/vulns";
import { setOversell } from "../../../../sim/90-actions/oversell";
import { useStore } from "../../../store";
import { ram } from "../../hw";
import { Facts, type Fact } from "./PanelBase";

const num = (n: number) => `${+n.toFixed(2)}`;

// Booked and used capacity of a panel host with the oversell cap; Pterodaktyl takes the cap as an overallocation percentage.
export function Oversell({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), percent = familyOf(c) === "pterodaktyl";
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

// What the software page of a panel or game host adds under its actions.
export function HostSettings({ game, c }: { game: GameState; c: Cluster }) {
  return oversold(c) ? <div className="cx-host-settings"><Oversell game={game} c={c} /></div> : null;
}
