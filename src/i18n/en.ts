const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Params = Record<string, string | number>;

export const en: Record<string, (p: Params) => string> = {
  "event.monthStart.title": (p) => `${MONTHS[Number(p.month)]} ${p.year}`,
  "event.monthStart.text": () => "A new month has started.",
  "save.loaded.title": () => "Game loaded",
  "save.loaded.text": () => "You are back where you left off.",
  "save.failed.title": () => "Saving failed",
  "save.failed.text": () => "The browser refused to store the save.",
  "save.imported.title": () => "Save imported",
  "save.imported.text": () => "You continue from the imported save.",
  "save.importFailed.title": () => "Import failed",
  "save.importFailed.text": () => "The file is not a Backbone save.",
  "game.new.title": () => "New company",
  "game.new.text": () => "You start with €5,000 and a server in the basement.",
};

export const t = (key: string, params: Params = {}): string => en[key]?.(params) ?? key;
