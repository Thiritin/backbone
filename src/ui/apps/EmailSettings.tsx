import { Check, Server, X } from "lucide-react";
import { useRef, type ComponentType, type CSSProperties } from "react";
import { euro } from "../../sim/00-core/money";
import { yearOf } from "../../sim/00-core/time";
import type { GameState } from "../../sim/50-state";
import { FREEMAIL, mailHost, mailImpaired, MAIL_PROVIDERS, salesAddress, seatsFor } from "../../sim/80-business/mail";
import { bookMail, cancelMail, selectMailServer } from "../../sim/90-actions/mail";
import type { MarkProps } from "../art/mailmarks";
import { MAIL, GMIX } from "./support/desk";
import { useDismiss } from "./locations/ui";
import { useStore } from "../store";
import "./email.css";
import { t } from "../../i18n/en";

function status(game: GameState): string {
  if (mailHost(game)?.switching) return t("apps.mail.installing");
  return mailImpaired(game) ? t("apps.mail.impaired") : t("apps.mail.delivering");
}

interface Option { id: string; name: string; note: string; on: boolean; off: boolean; pick: () => void; mark?: { icon: ComponentType<MarkProps>; tile: string } }

// The company's email as a sheet over the app: free GMix, an external provider per seat, or its own mail server.
export function EmailSettings({ onClose }: { onClose: () => void }) {
  const { game, act } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const m = game.company.mail, year = yearOf(game.hour), seats = seatsFor(game), host = game.clusters.find((c) => c.kind === "mail");
  const options: Option[] = [
    { id: "free", name: FREEMAIL, note: t("apps.mail.freeNote"), on: m.kind === "free", off: false, pick: () => act(cancelMail), mark: GMIX },
    ...MAIL_PROVIDERS.map((p): Option => ({
      id: p.id, name: p.name, on: m.kind === "external" && m.provider === p.id, off: year < p.from || !game.company.domain, pick: () => act(bookMail, p.id), mark: MAIL[p.id],
      note: year < p.from ? t("apps.mail.availableFrom", { year: p.from }) : !game.company.domain ? t("apps.mail.needDomain") : t("apps.mail.perSeat", { seat: euro(p.price(year)), total: euro(seats * p.price(year)) }),
    })),
    { id: "self", name: t("apps.mail.selfHost"), note: host ? host.name : t("apps.mail.needServer"), on: m.kind === "self", off: !host, pick: () => act(selectMailServer) },
  ];
  return (
    <div className="mail-scrim">
      <div ref={ref} className="mail-sheet" role="dialog" aria-modal="true" aria-label={t("apps.mail.settings")}>
        <div className="mail-sheet-h"><h2>{t("apps.mail.settings")}</h2><button className="btn ghost icon" aria-label={t("apps.close")} onClick={onClose}><X /></button></div>
        <dl className="mail-facts">
          <div><dt>{t("apps.mail.address")}</dt><dd>{salesAddress(game)}</dd></div>
          <div><dt>{t("apps.mail.status")}</dt><dd>{status(game)}</dd></div>
        </dl>
        <div className="mail-options" role="radiogroup" aria-label={t("apps.mail.provider")}>
          {options.map(({ mark, ...o }) => (
            <button key={o.id} role="radio" aria-checked={o.on} disabled={o.off} className="mail-option" onClick={() => !o.on && o.pick()}>
              <span className="mail-tile" style={{ "--tile": mark?.tile ?? "var(--text-3)" } as CSSProperties}>{mark ? <mark.icon /> : <Server />}</span>
              <span className="mail-name">{o.name}<small>{o.note}</small></span>
              {o.on && <Check className="mail-check" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
