import { BookOpen, Disc3, FileArchive, FileText, Package } from "lucide-react";
import type { ComponentType } from "react";
import { PearMailMark, type MarkProps } from "./mailmarks";

type Pack = "crystal" | "oxygen";

// Renders every era's picture at once; os.css shows the one for the current data-os, the lucide mark after Oxygen.
export const era = (Icon: ComponentType<MarkProps>, name: string, packs: Pack[] = ["crystal", "oxygen"]) => ({ className }: MarkProps) => (
  <>
    {packs.map((p) => <img key={p} className={`era-img era-${p}`} src={`${import.meta.env.BASE_URL}icons/${p}/${name}.webp`} loading="lazy" alt="" draggable={false} />)}
    <Icon className={className} />
  </>
);

// Desktop and Finder files by Doc kind, plus downloads.
export const FILE_ICON: Record<string, ComponentType<MarkProps>> = {
  guide: era(BookOpen, "guide"),
  note: era(FileText, "note"),
  form: era(FileText, "form"),
  cert: era(FileText, "cert"),
  iso: era(Disc3, "iso"),
  archive: era(FileArchive, "archive"),
  pdf: era(FileText, "pdf"),
  installer: era(Package, "installer"),
};

export function fileIcon(name: string) {
  const Icon = /\.(zip|tar|t?gz|bz2|xz|7z|rar)$/i.test(name) ? FILE_ICON.archive : /\.pdf$/i.test(name) ? FILE_ICON.pdf : FILE_ICON.note;
  return <Icon />;
}

export const ICON_CREDITS = [
  { text: "Crystal Clear, Everaldo Coelho, LGPL 2.1", url: "https://commons.wikimedia.org/wiki/Category:Crystal_Clear_icons" },
  { text: "Oxygen, KDE, LGPL 3.0", url: "https://develop.kde.org/frameworks/oxygen-icons/" },
];

export const PearMailIcon = era(PearMailMark, "pear-mail");
