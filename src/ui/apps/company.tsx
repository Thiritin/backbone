import { Cloud, Cpu, Database, Flame, Globe, Leaf, Mountain, Rocket, Server, Shield, Waves, Zap, type LucideIcon } from "lucide-react";
import { useId, type CSSProperties } from "react";
import type { Company } from "../../sim/50-state";
import { COMPANY_COLORS, COMPANY_LOGOS, NAME_MAX } from "../../sim/90-actions/company";

const ICONS: Record<string, LucideIcon> = {
  server: Server, cloud: Cloud, zap: Zap, globe: Globe, rocket: Rocket, database: Database,
  cpu: Cpu, shield: Shield, leaf: Leaf, mountain: Mountain, waves: Waves, flame: Flame,
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
