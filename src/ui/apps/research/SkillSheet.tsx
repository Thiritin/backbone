import { GraduationCap } from "lucide-react";
import { skillById } from "../../../sim/10-catalog/research";
import { storeItem } from "../../../sim/10-catalog/store";
import { Intro } from "../../desktop/Intro";
import { SKILL_PAGES } from "../../desktop/intro-text";
import { Tile } from "../shop/Software";

export function SkillSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const skill = skillById(id);
  const pages = skill && SKILL_PAGES[skill.name];
  if (!pages) return null;
  const art = skill.opens.length ? skill.opens.map((i) => <Tile key={i} item={storeItem(i)!} size={84} />) : <GraduationCap className="intro-glyph" />;
  return <Intro pages={pages} art={art} onClose={onClose} />;
}
