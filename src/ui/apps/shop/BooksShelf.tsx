import { Receipt } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { vendorsIn, type BooksVendor } from "../../../sim/10-catalog/bookkeeping";
import { currentVendor } from "../../../sim/80-business/bookkeeping";
import { installBooks, uninstallBooks } from "../../../sim/90-actions/bookkeeping";
import { Confirm } from "../../desktop/Confirm";
import { useFocus, useStore } from "../../store";

export const BOOKKEEPING = "Bookkeeping";

// The smallest edition's price, which the shelf installs.
export const booksPrice = (v: BooksVendor): string => {
  const e = v.editions[0];
  if (v.deployment === "browser") return t("shop.priceMonthly", { price: euro(e.price), seat: 0 });
  if (!e.price) return t("books-editions.free");
  return [t("books-vendors.priceOnce", { price: euro(e.price) }), ...(e.update ? [t("books-vendors.priceUpdates", { price: euro(e.update) })] : [])].join(", ");
};

// The Pear Store shelf of bookkeeping programs on sale this year.
export function BooksShelf() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const [switching, setSwitching] = useState<BooksVendor | null>(null);
  const ref = useRef<HTMLElement>(null);
  useFocus("Shop", (f) => { if (f.kind === "software" && f.id === BOOKKEEPING) ref.current?.scrollIntoView({ block: "start" }); });
  const current = currentVendor(game);
  const action = (v: BooksVendor) => {
    if (current?.id === v.id) return (
      <>
        <button className="ps-get" onClick={() => act(uninstallBooks)}>{t("dataFlow.uninstall")}</button>
        <button className="ps-get" onClick={() => openApp("Books")}>{t("shop.open")}</button>
      </>
    );
    if (current) return <button className="ps-get" onClick={() => setSwitching(v)}>{t("books-vendors.switch")}</button>;
    return <button className="ps-get primary" onClick={() => act(installBooks, v.id)}>{t("shop.get")}</button>;
  };
  return (
    <section ref={ref} className="ps-shelf">
      <h3>{t(`shop.shelf.${BOOKKEEPING}`)}</h3>
      <div className="ps-rows">
        {vendorsIn(yearOf(game.hour)).map((v) => (
          <div key={v.id} className="ps-row">
            <span className="ps-tile" style={{ "--tile": v.skin.accent, "--size": "52px" } as CSSProperties}><Receipt /></span>
            <span className="ps-row-text">
              <strong>{v.program}</strong>
              <span>{t(`books-vendors.about.${v.id}`)}</span>
              <span className="num">{booksPrice(v)}</span>
            </span>
            {action(v)}
          </div>
        ))}
      </div>
      {switching && current && <Confirm title={t("books-vendors.switchTitle", { program: switching.program })} action={t("books-vendors.switch")}
        text={t("books-vendors.switchText", { program: switching.program, current: current.program })}
        onCancel={() => setSwitching(null)} onConfirm={() => { setSwitching(null); act(installBooks, switching.id); }} />}
    </section>
  );
}
