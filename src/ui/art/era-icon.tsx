import { BookOpen, Disc3, FileText, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { MarkProps } from "./mailmarks";

type Pack = "crystal" | "oxygen";

// Renders every era's picture at once; os.css shows the one for the current data-os, the lucide mark after Oxygen.
export const era = (Icon: LucideIcon, name: string, packs: Pack[] = ["crystal", "oxygen"]) => ({ className }: MarkProps) => (
  <>
    {packs.map((p) => <img key={p} className={`era-img era-${p}`} src={`${import.meta.env.BASE_URL}icons/${p}/${name}.webp`} loading="lazy" alt="" draggable={false} />)}
    <Icon className={className} />
  </>
);

// Desktop and Finder files by Doc kind, plus downloaded disc images.
export const FILE_ICON: Record<string, ComponentType<MarkProps>> = {
  guide: era(BookOpen, "guide"),
  note: era(FileText, "note"),
  form: era(FileText, "form"),
  cert: era(FileText, "cert"),
  iso: era(Disc3, "iso"),
};

export const ICON_CREDITS = [
  { text: "Crystal Clear, Everaldo Coelho, LGPL 2.1", url: "https://commons.wikimedia.org/wiki/Category:Crystal_Clear_icons" },
  { text: "Oxygen, KDE, LGPL 3.0", url: "https://develop.kde.org/frameworks/oxygen-icons/" },
];
