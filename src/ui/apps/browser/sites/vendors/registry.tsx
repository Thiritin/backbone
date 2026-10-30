import type { ComponentType } from "react";
import { monthIndexOf, yearOf } from "../../../../../sim/00-core/time";
import { MANUFACTURERS } from "../../../../../sim/10-catalog/hardware";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost } from "../../../../../sim/80-business/browser";
import { vendorHost } from "../../../../../sim/80-business/vendors";
import { eraOf } from "../era";
import { Aristotle } from "./aristotle";
import { Avn } from "./avn";
import { Dwell } from "./dwell";
import { Eatin } from "./eatin";
import { Fortinope } from "./fortinope";
import { Gigabutt } from "./gigabutt";
import { HewlettPacket } from "./hewlett-packet";
import { Junipurr } from "./junipurr";
import { Lenovoid } from "./lenovoid";
import { MicroTick } from "./microtick";
import { PabloAlto } from "./pablo-alto";
import { Pandoot } from "./pandoot";
import { SuperMacro } from "./supermacro";
import { Sysko } from "./sysko";
import { pageOf, type VendorProps } from "./VendorSite";

// docs/design/software.md, 8.6: each manufacturer's site and the year its late look starts.
const SITES: Record<string, { view: ComponentType<VendorProps>; late: number }> = {
  dwell: { view: Dwell, late: 2013 },
  "hewlett-packet": { view: HewlettPacket, late: 2013 },
  supermacro: { view: SuperMacro, late: 2016 },
  lenovoid: { view: Lenovoid, late: 2014 },
  gigabutt: { view: Gigabutt, late: 2018 },
  sysko: { view: Sysko, late: 2015 },
  junipurr: { view: Junipurr, late: 2014 },
  aristotle: { view: Aristotle, late: 2015 },
  fortinope: { view: Fortinope, late: 2014 },
  "pablo-alto": { view: PabloAlto, late: 2015 },
  pandoot: { view: Pandoot, late: 2016 },
  avn: { view: Avn, late: 2014 },
  microtick: { view: MicroTick, late: 2017 },
  eatin: { view: Eatin, late: 2015 },
};

export function VendorSite({ game, maker, path, go }: { game: GameState; maker: string; path: string; go: (url: string) => void }) {
  const m = MANUFACTURERS.find((x) => x.id === maker), site = SITES[maker];
  if (!m || !site) return null;
  const year = yearOf(game.hour), View = site.view;
  const look = eraOf([{ from: 2005, look: "early" }, { from: site.late, look: "late" }], year);
  return <View m={m} look={look} page={pageOf(path)} year={year} month={monthIndexOf(game.hour)} go={(to) => go(`${displayHost(vendorHost(m.id))}${to}`)} />;
}
