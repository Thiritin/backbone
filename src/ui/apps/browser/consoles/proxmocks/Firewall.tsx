import type { Workload } from "../../../../../sim/60-infra/cluster";
import { MACROS, type Macro } from "../../../../../sim/60-infra/exposure";
import { setFirewall } from "../../../../../sim/90-actions/firewall";
import { t } from "../../../../../i18n/en";
import { Facts } from "../PanelBase";
import { usePageAct } from "../../pageAct";

const NAME: Record<Macro, string> = { web: "HTTP", ssh: "SSH", mail: "SMTP", db: "MySQL", rdp: "RDP" };

// VM > Firewall: the switch with its input policy, and the allowed macros as read-only rule rows.
export function FirewallPanel({ w }: { w: Workload }) {
  const act = usePageAct(), fw = w.firewall ?? { on: false, allow: [] as Macro[] };
  const set = (next: Partial<typeof fw>) => act(setFirewall, w.id, { ...fw, ...next });
  const toggle = (m: Macro) => set({ allow: fw.allow.includes(m) ? fw.allow.filter((x) => x !== m) : [...fw.allow, m] });
  return (
    <>
      <section className="pmx-panel">
        <h4>{t("pmx.options")}</h4>
        <Facts facts={[{ label: t("pmx.firewall"), value: fw.on ? t("pmx.yes") : t("pmx.no") }, { label: t("pmx.inputPolicy"), value: fw.on ? "DROP" : "ACCEPT" }]} />
        <div className="cx-tools">
          <button className="cx-btn" aria-pressed={fw.on} onClick={() => set({ on: !fw.on })}>{fw.on ? t("pmx.disableFirewall") : t("pmx.enableFirewall")}</button>
          {MACROS.map((m) => <button key={m} className="cx-chip" aria-pressed={fw.allow.includes(m)} onClick={() => toggle(m)}>{NAME[m]}</button>)}
        </div>
      </section>
      <table className="cx-table">
        <thead><tr><th>{t("pmx.type")}</th><th>{t("pmx.action")}</th><th>{t("pmx.macro")}</th></tr></thead>
        <tbody>{fw.allow.map((m) => <tr key={m}><td>in</td><td>ACCEPT</td><td>{NAME[m]}</td></tr>)}</tbody>
      </table>
    </>
  );
}
