import { euro } from "../sim/00-core/money";

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
  "action.failed.title": () => "That didn't work",
  "game.new.title": () => "New company",
  "game.new.text": () => "You start with €5,000 and a server in the basement.",
  "event.bills.title": () => "Monthly bills",
  "event.bills.text": (p) => `You paid ${euro(Number(p.power))} for power and ${euro(Number(p.rent))} for rent.`,
  "ledger.hardware": (p) => `${p.model} for ${p.device}`,
  "ledger.power": () => "Power",
  "ledger.rent": (p) => `Rent for ${p.rack}`,
  "error.unknownCity": () => "There is no space to rent in this city.",
  "error.unknownRack": () => "This rack no longer exists.",
  "error.unknownDevice": () => "This device no longer exists.",
  "error.unknownPort": () => "This port does not exist.",
  "error.unknownCable": () => "This cable no longer exists.",
  "error.unknownBrand": () => "This brand does not sell servers.",
  "error.notInShop": () => "The shop does not sell this model.",
  "error.needsShelf": () => "This device only fits on a shelf.",
  "error.needsRack": () => "This device only fits in a rack.",
  "error.outOfBounds": () => "The device does not fit at this height.",
  "error.slotTaken": () => "Another device is in the way.",
  "error.noCash": () => "You do not have enough cash.",
  "error.cannotRemove": () => "This device belongs to the location.",
  "error.sameDevice": () => "Both ends are on the same device.",
  "error.portInUse": () => "A cable is already plugged into this port.",
  "error.otherLocation": () => "Both devices must be in the same location.",
  "error.mediaMismatch": () => "A copper port and an SFP port cannot be cabled together.",
  "error.speedMismatch": () => "Both ports must run at the same speed.",
  "error.notServer": () => "Only servers have a bond mode.",
  "error.notSwitch": () => "Only switches have port groups.",
  "error.groupSize": () => "A port group holds 2 to 8 ports.",
  "warning.bondNotGrouped": () => "The switch ports for this bond are not grouped.",
};

export const t = (key: string, params: Params = {}): string => en[key]?.(params) ?? key;
