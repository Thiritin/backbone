import { FileText } from "lucide-react";
import { useState } from "react";
import { t } from "../../i18n/en";
import { useFocus, useStore, type Focus } from "../store";
import { AUTHORITIES } from "../../sim/46-finance/payables";
import { Letter } from "./PostApp";
import { SupplierInvoice } from "./preview/SupplierInvoice";
import "./books/books.css";
import "./paper.css";

// The document viewer: opens the document a Focus names; kind "payable" is a supplier's invoice.
export function PreviewApp() {
  const game = useStore((s) => s.game);
  const [doc, setDoc] = useState<Pick<Focus, "kind" | "id"> | null>(null);
  useFocus("Preview", (f) => setDoc(f));
  const p = doc?.kind === "payable" ? game.payables.find((x) => x.id === doc.id) : undefined;
  if (!p) return <div className="fin-empty"><FileText />{t("preview.none")}</div>;
  // An authority sends no invoice of its own: its letter is the document.
  const letter = AUTHORITIES.includes(p.supplier) ? game.letters.find((l) => l.payable === p.id) : undefined;
  return <div className="books-preview">{letter ? <div className="paper-scroll"><div className="letter-fit"><Letter letter={letter} company={game.company.name} owner={game.registration?.owner} /></div></div> : <SupplierInvoice game={game} p={p} />}</div>;
}
