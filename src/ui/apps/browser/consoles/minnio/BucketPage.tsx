import { t } from "../../../../../i18n/en";
import { disk } from "../../../hw";
import { bucketsOf, storageOnCluster, type BucketPolicy } from "../../../../../sim/60-infra/netsvc-storage";
import { setBucketPolicy } from "../../../../../sim/90-actions/netsvc-storage";
import { useStore } from "../../../../store";
import type { PanelProps } from "../PanelBase";

const POLICIES: [BucketPolicy, string][] = [["private", "netsvc.policyPrivate"], ["readonly", "netsvc.policyReadonly"], ["public", "netsvc.policyPublic"]];

// The buckets of every customer on the cluster, each with its access policy.
export function BucketPage({ game, c }: { game: PanelProps["game"]; c: PanelProps["c"] }) {
  const act = useStore((s) => s.act), services = storageOnCluster(game, c.id);
  if (!services.length) return null;
  return (
    <table className="cx-table mn-buckets">
      <thead><tr><th>{t("netsvc.shareName")}</th><th>{t("netsvc.bucketUsage")}</th><th>{t("netsvc.bucketPolicy")}</th></tr></thead>
      <tbody>{services.flatMap((v) => bucketsOf(game, v).map((b) => (
        <tr key={`${v.id}-${b.id}`} data-policy={b.policy}>
          <td><b>{b.name}</b></td>
          <td className="num">{disk(b.usedGb)}</td>
          <td><select aria-label={t("netsvc.bucketPolicy")} value={b.policy} onChange={(e) => act(setBucketPolicy, v.id, b.id, e.target.value as BucketPolicy)}>
            {POLICIES.map(([id, key]) => <option key={id} value={id}>{t(key)}</option>)}
          </select></td>
        </tr>
      )))}</tbody>
    </table>
  );
}
