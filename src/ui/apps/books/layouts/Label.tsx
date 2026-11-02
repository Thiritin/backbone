import { t } from "../../../../i18n/en";
import type { Entry } from "./types";

// An entry's name and its count badge.
export const Label = ({ e }: { e: Entry }) => <>{t(`books.tab.${e.id}`)}{e.count ? <span className="tab-count num">{e.count}</span> : null}</>;
export const navProps = (e: Entry, active: string, pick: (id: string) => void) => ({
  "aria-current": e.id === active ? ("page" as const) : undefined, "aria-disabled": e.locked || undefined, onClick: () => pick(e.id),
});
