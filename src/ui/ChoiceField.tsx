import { useState } from "react";
import { t } from "../i18n/en";

const OTHER = "\u0000other";

// A select of known values with Other for a typed one; a value outside the list shows the text field.
export function ChoiceField({ value, choices, onChange, className, label }: { value: string; choices: string[]; onChange: (v: string) => void; className?: string; label?: string }) {
  const [typing, setTyping] = useState(false);
  if (typing || !choices.length || (value !== "" && !choices.includes(value)))
    return <input className={className} aria-label={label} value={value} autoFocus={typing} onChange={(e) => { setTyping(true); onChange(e.target.value); }} />;
  return (
    <select className={className} aria-label={label} value={value} onChange={(e) => (e.target.value === OTHER ? (setTyping(true), onChange("")) : onChange(e.target.value))}>
      {value === "" && <option value="" disabled />}
      {choices.map((c) => <option key={c} value={c}>{c}</option>)}
      <option value={OTHER}>{t("core.choice.other")}</option>
    </select>
  );
}
