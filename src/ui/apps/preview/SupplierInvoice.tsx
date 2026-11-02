import type { CSSProperties, ReactNode } from "react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { euroCents } from "../../../sim/00-core/money";
import { BANKS } from "../../../sim/10-catalog/banks";
import { BOOKS_VENDORS } from "../../../sim/10-catalog/bookkeeping";
import { SOFTWARE } from "../../../sim/10-catalog/platforms";
import { REGISTRARS } from "../../../sim/10-catalog/registrars";
import { SERVER_OS } from "../../../sim/10-catalog/server-os";
import { SHOP_LICENCES } from "../../../sim/10-catalog/shop-licences";
import { DATACENTERS } from "../../../sim/20-world/datacenters";
import { ownAddress } from "../../../sim/30-customers/addresses";
import { groupIban, ibanEra } from "../../../sim/46-finance/bank";
import { SUPPLIER_CODE, supplierAccount, supplierHost, supplierIban, type Payable } from "../../../sim/46-finance/payables";
import type { GameState } from "../../../sim/50-state";
import { INPUT_CATEGORIES, vatRate } from "../../../sim/80-business/tax";
import { brandColor, hasMark, Logo } from "../../art/logos";
import { formatDay } from "../billing/format";
import { addressLines } from "../books/InvoicesTab";
import { hueOf } from "../browser/Favicon";
import { REGISTRAR_HUE } from "../browser/sites/registrars/RegistrarPage";
import { SITE_COLOR, SiteMark } from "../browser/sites/software/marks";
import "./supplier-invoice.css";

// Suppliers without a site of their own in the game.
const OWN: Record<string, string> = {
  "E.OFF": "#e3241b", Alternatte: "#c8102e", Pear: "#4a4a4f", VeriSigh: "#1f4e9c", Finanzamt: "#1c3f8c", Lexwear: "#c8102e",
};
const LAYOUTS = ["classic", "modern", "letterhead"] as const;

const Tile = ({ color, name }: { color: string; name: string }) => (
  <svg className="logo-mark" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1" y="1" width="14" height="14" rx="3.5" fill={color} />
    <text x="8" y="11.6" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white" fontFamily="Verdana, sans-serif">{name[0]?.toUpperCase()}</text>
  </svg>
);
const word = (mark: ReactNode, name: string) => <span className="logo">{mark}<span className="logo-word">{name}</span></span>;

// The supplier's logo and colour, from its mark, its site or bank skin, else a hue of its name; the layout goes by company,
// so every site of a datacenter provider bills alike.
export function supplierBrand(name: string): { color: string; logo: ReactNode; layout: typeof LAYOUTS[number] } {
  const provider = DATACENTERS.find((d) => d.name === name)?.provider, mark = provider ?? name.toLowerCase().replace(/ /g, "-");
  const layout = LAYOUTS[hueOf(provider ?? name) % LAYOUTS.length];
  if (hasMark(mark)) return { color: brandColor(mark), logo: <Logo provider={mark} word />, layout };
  const sw = [...SERVER_OS, ...SOFTWARE, ...SHOP_LICENCES].find((x) => x.name === name);
  if (sw) {
    const color = SITE_COLOR[sw.id] ?? `oklch(0.5 0.13 ${hueOf(name)})`;
    return { color, logo: word(<SiteMark id={sw.id} name={name} color={color} />, name), layout };
  }
  const reg = REGISTRARS.find((r) => r.name === name), bank = BANKS.find((b) => b.name === name), books = BOOKS_VENDORS.find((b) => b.name === name);
  const color = OWN[name] ?? (reg && `oklch(0.55 0.15 ${REGISTRAR_HUE[reg.id]})`) ?? (bank && (bank.skin.frame === "plain" ? "#003366" : bank.skin.bar))
    ?? books?.skin.accent ?? `oklch(0.5 0.13 ${hueOf(name)})`;
  return { color, logo: word(<Tile color={color} name={name} />, name), layout };
}

// A supplier's invoice in its own colours and layout.
export function SupplierInvoice({ game, p }: { game: GameState; p: Payable }) {
  const { color, logo, layout } = supplierBrand(p.name);
  const web = `www.${supplierHost(p.name)}`, total = p.lines.reduce((n, l) => n - l.amount, 0);
  const rate = vatRate(p.issuedAt);
  // Prices are gross, so the VAT is the share the input-tax lines carry.
  const vat = -p.lines.filter((l) => INPUT_CATEGORIES.includes(l.category)).reduce((n, l) => n + l.amount, 0) * rate / (1 + rate);
  const bank = ibanEra(game)
    ? `${t("checkout.iban")} ${groupIban(supplierIban(p.supplier))}`
    : `${t("paperwork.letter.account")} ${supplierAccount(p.supplier)} · ${t("paperwork.letter.code")} ${SUPPLIER_CODE}`;
  const meta: [string, string][] = [
    [t("preview.number"), p.number], [t("preview.date"), formatDay(p.issuedAt)], [t("preview.due"), formatDay(p.dueAt)],
    ...(p.paidAt !== null ? [[t("preview.paid"), formatDay(p.paidAt)] as [string, string]] : []),
  ];
  return (
    <div className="books-a4-fit">
      <article className={`books-a4 inv inv-${layout}`} style={{ "--brand": color } as CSSProperties} aria-label={t("books.invoice", { number: p.number })}>
        <header className="inv-head">
          <div className="inv-logo">{logo}</div>
          <div className="inv-sender"><b>{p.name}</b><span>{web}</span></div>
        </header>
        <div className="inv-addr">
          <address>
            <small>{p.name} · {web}</small>
            {addressLines(ownAddress(game)).map((l) => <div key={l}>{l}</div>)}
          </address>
          <dl className="inv-meta">{meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
        </div>
        <h2>{t("preview.invoice")}</h2>
        <table>
          <thead><tr><th className="inv-pos">{t("books.col.number")}</th><th>{t("books.col.item")}</th><th className="r">{t("books.col.amount")}</th></tr></thead>
          <tbody>
            {p.lines.map((l, n) => <tr key={n}><td className="inv-pos num">{n + 1}</td><td>{t(l.key, l.params)}</td><td className="r num">{euroCents(-l.amount)}</td></tr>)}
            <tr className="inv-total"><td /><td>{t("books.total")}</td><td className="r num">{euroCents(total)}</td></tr>
          </tbody>
        </table>
        {vat > 0 && <p className="inv-vat num">{t("preview.vat", { rate: rate.toLocaleString(LOCALE, { style: "percent" }), amount: euroCents(vat) })}</p>}
        <footer className="inv-foot">
          <span>{p.name}</span><span>{web}</span><span>{t("paperwork.letter.bank")}: <span className="num">{bank}</span></span>
        </footer>
      </article>
    </div>
  );
}
