import type { GameState } from "../../../../../sim/50-state";
import { mailAddress } from "../../../../../sim/60-infra/addresses";
import { mailServices } from "../../../../../sim/60-infra/netsvc-mail";
import { quotaOf, quotaUsers } from "../../../../../sim/60-infra/netsvc-quota";
import { setQuota } from "../../../../../sim/90-actions/netsvc-quota";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { useStore } from "../../../../store";

const STEPS = [50, 250, 1000, 5000, 15000, 50000];
export const mb = (n: number) => t("netsvc.mb", { n: Math.round(n).toLocaleString(LOCALE) });

// The quota dropdown of a service: the usual steps plus the value it has now.
export function QuotaSelect({ serviceId, current }: { serviceId: string; current: number }) {
  const act = useStore((s) => s.act), steps = [...new Set([...STEPS, current])].sort((a, b) => a - b);
  return <select value={current} aria-label={t("browser-consoles-1.mpQuota")} onChange={(e) => act(setQuota, serviceId, Number(e.target.value))}>{steps.map((n) => <option key={n} value={n}>{mb(n)}</option>)}</select>;
}

// The mail customers whose mailboxes live on this server, with their quota and what they have stored.
export function CustomerQuotas({ game, clusterId }: { game: GameState; clusterId: string }) {
  const a = mailAddress(game, clusterId), rows = a ? mailServices(game, a.id) : [];
  if (rows.length === 0) return null;
  return (
    <table className="cx-table">
      <thead><tr><th>{t("browser-consoles-1.domain")}</th><th>{t("browser-consoles-1.mpMailboxes")}</th><th>{t("browser-consoles-1.mpQuota")}</th><th>{t("netsvc.used")}</th></tr></thead>
      <tbody>{rows.map((v) => {
        const q = quotaOf(game, v);
        return <tr key={v.id}><td><b>{v.domain ?? v.label}</b></td><td className="num">{v.spec.mailboxes}</td><td><QuotaSelect serviceId={v.id} current={q.perUserMb} /></td><td className="num">{mb(q.usedMb)} / {mb(q.perUserMb * quotaUsers(v))}</td></tr>;
      })}</tbody>
    </table>
  );
}
