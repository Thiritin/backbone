import { Cat, Cloud, Cpu, Database, Flame, Globe, Leaf, Mountain, Rocket, Server, Shield, Waves, Zap, createLucideIcon, type LucideIcon } from "lucide-react";
import { useId, type CSSProperties } from "react";
import type { Company } from "../../sim/50-state";
import { COMPANY_COLORS, COMPANY_LOGOS, NAME_MAX } from "../../sim/90-actions/company";

// Animal and appliance marks lucide does not ship, drawn on the same 24 grid and stroke.
const Wolf = createLucideIcon("wolf", [
  ["path", { d: "M5 2v8l-2 4 5 6h8l5-6-2-4V2l-5 4h-4z", key: "head" }],
  ["path", { d: "M9 14v.5M15 14v.5", key: "eyes" }],
  ["path", { d: "M10.5 18h3l-1.5 2z", key: "nose" }],
]);
const Fox = createLucideIcon("fox", [
  ["path", { d: "M3 3l5 4h8l5-4v9c0 4-4 9-9 9s-9-5-9-9z", key: "head" }],
  ["path", { d: "M8.5 13v.5M15.5 13v.5", key: "eyes" }],
  ["path", { d: "M10.5 17h3L12 19z", key: "nose" }],
]);
const Toaster = createLucideIcon("toaster", [
  ["rect", { x: "3", y: "8", width: "18", height: "11", rx: "3", key: "body" }],
  ["path", { d: "M8 8V6.5h8V8", key: "top" }],
  ["path", { d: "M8 13h8", key: "slot" }],
  ["path", { d: "M21 12h1.5", key: "lever" }],
]);

const ICONS: Record<string, LucideIcon> = {
  server: Server, cloud: Cloud, zap: Zap, globe: Globe, rocket: Rocket, database: Database,
  cpu: Cpu, shield: Shield, leaf: Leaf, mountain: Mountain, waves: Waves, flame: Flame,
  wolf: Wolf, fox: Fox, cat: Cat, toaster: Toaster,
};
const tile = (color: string) => ({ "--tile": color }) as CSSProperties;

export function CompanyMark({ company, className = "co-mark" }: { company: Company; className?: string }) {
  const Icon = ICONS[company.logo] ?? Server;
  return <span className={className} style={tile(company.color)}><Icon /></span>;
}

interface Props { company: Company; onChange: (patch: Partial<Company>) => void; onCommit?: () => void }

// Name, logo and colour fields; onCommit fires when the name field loses focus or Enter is pressed.
export function CompanyFields({ company, onChange, onCommit }: Props) {
  const id = useId();
  return (
    <div className="co-fields">
      <label className="co-label" htmlFor={`${id}n`}>Company name</label>
      <input id={`${id}n`} className="field" maxLength={NAME_MAX} value={company.name} spellCheck={false}
        onChange={(e) => onChange({ name: e.target.value })} onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      <span className="co-label" id={`${id}l`}>Logo</span>
      <div className="co-logos" role="group" aria-labelledby={`${id}l`}>
        {COMPANY_LOGOS.map((l) => (
          <button key={l} aria-label={l[0].toUpperCase() + l.slice(1)} aria-pressed={company.logo === l} onClick={() => onChange({ logo: l })}>
            <CompanyMark company={{ ...company, logo: l }} />
          </button>
        ))}
      </div>
      <span className="co-label" id={`${id}c`}>Colour</span>
      <div className="co-colors" role="group" aria-labelledby={`${id}c`}>
        {COMPANY_COLORS.map((c, i) => (
          <button key={c} aria-label={`Colour ${i + 1}`} aria-pressed={company.color === c} style={tile(c)} onClick={() => onChange({ color: c })} />
        ))}
      </div>
    </div>
  );
}
