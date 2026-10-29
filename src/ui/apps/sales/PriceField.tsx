import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { euroCents } from "../../../sim/00-core/money";

// Within 5% of the reference counts as near the market.
const NEAR = 0.05;
export function marketSide(price: number, reference: number): { label: string; cls: string } {
  const r = price / reference;
  if (r < 1 - NEAR) return { label: "Below market", cls: "" };
  if (r > 1 + NEAR) return { label: "Above market", cls: "warn" };
  return { label: "Near market", cls: "ok" };
}

// A monthly price with steppers of 5% of the reference, the market reference beside it and how the price compares.
export function PriceField({ value, reference, onChange, disabled, label = "Monthly price" }: {
  value: number; reference: number; onChange: (v: number) => void; disabled?: boolean; label?: string;
}) {
  const id = useId();
  const step = Math.max(0.05, Math.round(reference * NEAR * 20) / 20);
  const set = (v: number) => onChange(Math.max(0, Math.round(v * 100) / 100));
  const side = value > 0 ? marketSide(value, reference) : null;
  return (
    <div className="price-field">
      <label className="price-label" htmlFor={id}>{label}</label>
      <div className="price-row">
        <div className="stepper">
          <button type="button" className="btn icon" aria-label="Lower price" disabled={disabled} onClick={() => set(value - step)}><Minus /></button>
          <span className="price-input">
            <input id={id} type="number" min={0} step={0.01} value={Number.isFinite(value) ? value : ""} disabled={disabled}
              onChange={(e) => set(Number(e.target.value))} />
            <span aria-hidden>€</span>
          </span>
          <button type="button" className="btn icon" aria-label="Raise price" disabled={disabled} onClick={() => set(value + step)}><Plus /></button>
        </div>
        <span className="price-ref">Market <span className="num">{euroCents(reference)}</span></span>
        {side && <span className={`pill ${side.cls}`}>{side.label}</span>}
      </div>
    </div>
  );
}
