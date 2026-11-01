import type { ReactNode } from "react";

// The document views' toolbar: flat buttons with an icon over the label.
export const DocBar = ({ children }: { children: ReactNode }) => <div className="books-docbar" role="toolbar">{children}</div>;

export function DocButton({ icon, label, onClick, disabled, pressed }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return <button type="button" className="books-docbtn" disabled={disabled} aria-pressed={pressed} onClick={onClick}>{icon}<span>{label}</span></button>;
}

// The status line under a document list, label and value pairs.
export function DocFoot({ items }: { items: [string, string][] }) {
  return <div className="books-docfoot">{items.map(([k, v]) => <span key={k}>{k}: <b className="num">{v}</b></span>)}</div>;
}
