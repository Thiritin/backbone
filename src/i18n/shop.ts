type Params = Record<string, string | number>;

// Shop systems: errors and ledger lines; spread into en.
export const SHOP_EN: Record<string, (p: Params) => string> = {
  "error.unknownShop": () => "There is no such shop system.",
  "error.needsShopSkill": () => "Research Shop systems first.",
  "error.shopInUse": () => "This shop system already runs your orders.",
  "error.shopNotSold": () => "This shop system is not sold this year.",
  "error.shopNoOwn": () => "This shop system is only leased.",
  "error.unknownModule": () => "There is no such module.",
  "error.moduleOwned": () => "You already have this module.",
  "error.needsOrderForm": () => "Set up the order form first.",
  "error.moduleNotSold": () => "Your shop system sells no extra modules.",
  "error.needsShop": () => "Choose a shop system first.",
  "error.unknownProduct": () => "There is no such product line.",
  "error.noAutoStock": () => "Your shop system cannot follow free capacity.",
  "error.badStock": () => "Stock is a whole number of zero or more.",
  "ledger.shopSetup": (p) => `Shop system: ${p.name}`,
  "ledger.shopLicence": (p) => `Shop licence: ${p.name}`,
  "ledger.shopUpdates": (p) => `Shop updates: ${p.name}`,
  "ledger.shopCut": (p) => `Shop revenue share: ${p.name}`,
  "ledger.shopModule": (p) => `Shop module: ${p.module}`,
};
