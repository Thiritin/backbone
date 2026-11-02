import { FileText } from "lucide-react";
import { useState } from "react";
import { t } from "../../i18n/en";
import { useFocus, useStore, type Focus } from "../store";
import { SupplierInvoice } from "./preview/SupplierInvoice";
import "./books/books.css";

// The document viewer: opens the document a Focus names; kind "payable" is a supplier's invoice.
export function PreviewApp() {
  const game = useStore((s) => s.game);
  const [doc, setDoc] = useState<Pick<Focus, "kind" | "id"> | null>(null);
  useFocus("Preview", (f) => setDoc(f));
  const p = doc?.kind === "payable" ? game.payables.find((x) => x.id === doc.id) : undefined;
  if (!p) return <div className="fin-empty"><FileText />{t("preview.none")}</div>;
  return <div className="books-preview"><SupplierInvoice game={game} p={p} /></div>;
}
