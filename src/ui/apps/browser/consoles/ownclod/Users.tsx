import { t } from "../../../../../i18n/en";
import { disk } from "../../../hw";
import { quotaOf, quotaUsers } from "../../../../../sim/60-infra/netsvc-quota";
import { storageOnCluster } from "../../../../../sim/60-infra/netsvc-storage";
import { setQuota } from "../../../../../sim/90-actions/netsvc-quota";
import { useStore } from "../../../../store";
import type { PanelProps } from "../PanelBase";

const CHOICES = [1024, 5120, 10240, 20480];

// The user table of each customer with the quota that applies to all of its users.
export function Users({ game, c }: { game: PanelProps["game"]; c: PanelProps["c"] }) {
  const act = useStore((s) => s.act);
  return <>{storageOnCluster(game, c.id).map((v) => {
    const q = quotaOf(game, v), n = quotaUsers(v), options = CHOICES.includes(q.perUserMb) ? CHOICES : [...CHOICES, q.perUserMb].sort((a, b) => a - b);
    return (
      <section key={v.id}>
        <h2>{v.label}</h2>
        <table className="cx-table">
          <thead><tr><th>{t("netsvc.userName")}</th><th>{t("netsvc.userUsed")}</th><th>{t("netsvc.userQuota")}</th></tr></thead>
          <tbody>{Array.from({ length: n }, (_, i) => (
            <tr key={i}>
              <td><b>user{i + 1}</b></td>
              <td className="num">{disk(Math.round(q.usedMb / n / 1024 * 10) / 10)}</td>
              <td><select aria-label={t("netsvc.userQuota")} value={q.perUserMb} onChange={(e) => act(setQuota, v.id, Number(e.target.value))}>
                {options.map((mb) => <option key={mb} value={mb}>{mb === q.perUserMb && !CHOICES.includes(mb) ? t("netsvc.quotaDefault") : disk(mb / 1024)}</option>)}
              </select></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    );
  })}</>;
}
