import { PBody } from "./ui";
import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import type { GameState } from "../../../../../../sim/50-state";
import { TEMPLATES, type ShopEmail } from "../../../../../../sim/80-business/shop-mail";
import { setMailTemplate } from "../../../../../../sim/90-actions/shop-orders";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import type { ScreenProps } from "./nav";

const subject = (m: ShopEmail) => t(`shop-mail.${m.template}.subject`, m.params);

// The shop's sent emails, newest first; a row opens the full message. customerId narrows it to one client.
export function EmailLog({ game, customerId }: { game: GameState; customerId?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = game.shop.emails.map((m, i) => [m, i] as const).filter(([m]) => !customerId || m.customerId === customerId).reverse();
  const shown = open === null ? undefined : game.shop.emails[open];
  return (
    <section className="pt-group">
      <table className="pt-table">
        <thead><tr><th>{t("shop-admin.date")}</th><th>{t("shop-mail.recipient")}</th><th>{t("shop-mail.subject")}</th><th>{t("shop-admin.status")}</th></tr></thead>
        <PBody>
          {rows.map(([m, i]) => (
            <tr key={i} className={i === open ? "on" : undefined}>
              <td className="num">{formatDay(m.at)}</td>
              <td>{game.customers.find((c) => c.id === m.customerId)?.name ?? m.params.name}</td>
              <td><a href="#" onClick={(e) => { e.preventDefault(); setOpen(i === open ? null : i); }}>{subject(m)}</a></td>
              <td>{t(m.failed ? "shop-mail.failed" : "shop-mail.sent")}</td>
            </tr>
          ))}
        </PBody>
      </table>
      {shown && (
        <article className="pt-group">
          <h3>{subject(shown)}</h3>
          <p className="pt-mail">{t(`shop-mail.${shown.template}.body`, shown.params)}</p>
        </article>
      )}
    </section>
  );
}

// Email Templates with an on switch each, and the Email Message Log.
export function Emails({ game }: ScreenProps) {
  const act = useStore((s) => s.act);
  return (
    <div className="pt-screen">
      <h3>{t("shop-mail.templates")}</h3>
      <div className="pt-checks">
        {TEMPLATES.map((x) => (
          <label key={x}>
            <input type="checkbox" checked={!game.shop.mailOff.includes(x)} onChange={(e) => act(setMailTemplate, x, e.target.checked)} /> {t(`shop-mail.name.${x}`)}
          </label>
        ))}
      </div>
      <h3>{t("shop-mail.log")}</h3>
      <EmailLog game={game} />
    </div>
  );
}
