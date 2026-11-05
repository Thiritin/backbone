import { Children } from "react";
import { t } from "../../../../../../i18n/en";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TableHTMLAttributes } from "react";

// Plain elements with .pt-* classes: each skin's CSS gives them the look of its own era, so no desktop control styles reach a shop page.
export const PBtn = ({ primary, className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) => (
  <button {...p} className={`pt-btn${primary ? " primary" : ""} ${className}`.trim()} />
);
export const PSelect = ({ className = "", ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`pt-select ${className}`.trim()} />;
export const PInput = ({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`pt-input ${className}`.trim()} />;
export const PCheck = (p: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) => <input {...p} type="checkbox" className="pt-check" />;
export const PBadge = ({ tone, children }: { tone?: "ok" | "warn" | "bad"; children: ReactNode }) => <span className={`pt-badge${tone ? ` ${tone}` : ""}`}>{children}</span>;
export const PTable = ({ className = "", ...p }: TableHTMLAttributes<HTMLTableElement>) => <table {...p} className={`pt-table ${className}`.trim()} />;
export const PBox = ({ title, children, ...p }: HTMLAttributes<HTMLElement> & { title: string }) => (
  <section {...p} className="pt-box"><h3 className="pt-box-h">{title}</h3><div className="pt-box-b">{children}</div></section>
);

// A table body that shows the empty row of the real products when there is nothing to list.
export const PBody = ({ children }: { children?: ReactNode }) => (
  <tbody>{Children.toArray(children).length ? children : <tr className="pt-empty"><td colSpan={99}>{t("shop-admin.d.empty")}</td></tr>}</tbody>
);
