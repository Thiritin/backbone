import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";

const plain = (v: number) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, useGrouping: false }).format(v);
// Within 5% of the reference counts as near the market.
const NEAR = 0.05;
export function marketSide(price: number, reference: number): { label: string; cls: string } {
  const r = price / reference;
  if (r < 1 - NEAR) return { label: t("misc2.belowMarket"), cls: "" };
  if (r > 1 + NEAR) return { label: t("misc2.aboveMarket"), cls: "warn" };
  return { label: t("misc2.nearMarket"), cls: "ok" };
}

// A monthly price with steppers of 5% of the reference, the market reference beside it and how the price compares.
export function PriceField({ value, reference, onChange, disabled, label = t("misc2.monthlyPrice") }: {
  value: number; reference: number; onChange: (v: number) => void; disabled?: boolean; label?: string;
}) {
  const id = useId();
  // The text as typed: a half-typed "3," or "3." is not a number yet and must stay in the field.
  const [draft, setDraft] = useState<string | null>(null);
  const step = Math.max(0.05, Math.round(reference * NEAR * 20) / 20);
  const set = (v: number) => { setDraft(null); onChange(Math.max(0, Math.round(v * 100) / 100)); };
  const side = value > 0 ? marketSide(value, reference) : null;
  return (
    <div className="price-field">
      <label className="price-label" htmlFor={id}>{label}</label>
      <div className="price-row">
        <div className="stepper">
          <button type="button" className="btn icon" aria-label={t("misc2.lowerPrice")} disabled={disabled} onClick={() => set(value - step)}><Minus /></button>
          <span className="price-input">
            <input id={id} type="text" inputMode="decimal" value={draft ?? (Number.isFinite(value) ? plain(value) : "")} disabled={disabled}
              onChange={(e) => {
                const raw = e.target.value, v = Number(raw.replace(",", "."));
                setDraft(raw);
                if (raw.trim() && Number.isFinite(v)) onChange(Math.max(0, Math.round(v * 100) / 100));
              }}
              onBlur={() => setDraft(null)} />
            <span aria-hidden>€</span>
          </span>
          <button type="button" className="btn icon" aria-label={t("misc2.raisePrice")} disabled={disabled} onClick={() => set(value + step)}><Plus /></button>
        </div>
        <span className="price-ref num">{t("misc2.market", { price: euroCents(reference) })}</span>
        {side && <span className={`pill ${side.cls}`}>{side.label}</span>}
      </div>
    </div>
  );
}
