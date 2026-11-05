import type { ReactNode } from "react";

export const Chip = ({ tone, children }: { tone?: "warn" | "ok" | "accent"; children: ReactNode }) => <span className={`sx-chip${tone ? ` ${tone}` : ""}`}>{children}</span>;

export const Card = ({ title, children, className }: { title?: string; children: ReactNode; className?: string }) => (
  <section className={`sx-card${className ? ` ${className}` : ""}`}>{title && <h2>{title}</h2>}{children}</section>
);

// A dashboard tile: one figure and what it counts.
export const Stat = ({ title, value, note, warn }: { title: string; value: string; note?: string; warn?: boolean }) => (
  <Card title={title} className={`sx-stat${warn ? " warn" : ""}`}><b className="num">{value}</b>{note && <small>{note}</small>}</Card>
);

export const Tabs = ({ items, value, onPick }: { items: { id: string; label: string; count?: number }[]; value: string; onPick: (id: string) => void }) => (
  <div className="sx-tabs" role="group">{items.map((i) => <button key={i.id} type="button" aria-pressed={i.id === value} onClick={() => onPick(i.id)}>{i.label}{i.count ? ` (${i.count})` : ""}</button>)}</div>
);

export const Empty = ({ children }: { children: ReactNode }) => <div className="sx-empty">{children}</div>;
