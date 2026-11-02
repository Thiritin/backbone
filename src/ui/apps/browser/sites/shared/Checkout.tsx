import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import type { PostalAddress } from "../../../../../sim/50-state";

export type AddressValue = PostalAddress & { company?: string };

// Street, postal code and city as table rows. autofill offers that address under the street field once it has focus.
export function AddressFields({ id, value, set, autofill, error }: {
  id: string; value: AddressValue; set: (v: AddressValue) => void; autofill?: AddressValue; error?: ReactNode;
}) {
  const [suggest, setSuggest] = useState(false);
  const field = (k: keyof PostalAddress, label: string, extra: ReactNode = null, auto?: string) => (
    <tr>
      <td><label htmlFor={`${id}-${k}`}>{label} <b>*</b></label></td>
      <td>
        <input id={`${id}-${k}`} value={value[k]} required autoComplete={auto} onChange={(e) => set({ ...value, [k]: e.target.value })}
          {...(k === "street" && { onFocus: () => setSuggest(true), onBlur: () => setSuggest(false) })} />
        {extra}
      </td>
    </tr>
  );
  const chip = autofill && suggest && (
    <button type="button" className="co-autofill" onMouseDown={(e) => { e.preventDefault(); set({ ...value, ...autofill }); setSuggest(false); }}>
      {[autofill.company, autofill.street, `${autofill.zip} ${autofill.city}`].filter(Boolean).join(", ")}
    </button>
  );
  return (
    <>
      {field("street", t("checkout.street"), chip, "street-address")}
      {field("zip", t("checkout.zip"), null, "postal-code")}
      {field("city", t("checkout.city"), error, "address-level2")}
    </>
  );
}
