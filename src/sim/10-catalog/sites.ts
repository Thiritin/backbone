// docs/design/software.md, section 8.3: the website of every software and operating system. host is bare, the Browser
// also takes it with www.; a look holds from its year until the next one.
import { t } from "../../i18n/en";

export type Look = "early" | "late";
export interface Site { host: string; tagline: string; blurb: string; features: string[]; eras: { from: number; look: Look }[] }

// Text is looked up when read, so it follows the active language.
export const site = (id: string, host: string, n: number, early: number, late?: number): Site => ({
  host,
  get tagline() { return t(`sim.site.${id}.tagline`); },
  get blurb() { return t(`sim.site.${id}.blurb`); },
  get features() { return Array.from({ length: n }, (_, i) => t(`sim.site.${id}.f${i}`)); },
  eras: late ? [{ from: early, look: "early" }, { from: late, look: "late" }] : [{ from: early, look: "early" }],
});

export const SITES: Record<string, Site> = {
  lunix: site("lunix", "debiant.org", 5, 2005, 2015),
  windoors: site("windoors", "windoors.macrosoft.com", 5, 2005, 2012),
  cpanic: site("cpanic", "cpanic.com", 6, 2005, 2014),
  pleskit: site("pleskit", "pleskit.com", 5, 2005, 2015),
  directadmen: site("directadmen", "directadmen.com", 5, 2005, 2018),
  freepanel: site("freepanel", "freepanel.org", 5, 2005, 2016),
  openveezee: site("openveezee", "openveezee.org", 5, 2005, 2016),
  openstash: site("openstash", "openstash.org", 5, 2010, 2017),
  vmwhere: site("vmwhere", "vmwhere.com", 5, 2005, 2015),
  proxmocks: site("proxmocks", "proxmocks.com", 5, 2008, 2016),
  hypervee: site("hypervee", "hypervee.macrosoft.com", 5, 2008, 2016),
  tcadmen: site("tcadmen", "tcadmen.com", 5, 2005, 2016),
  multikraft: site("multikraft", "multikraft.com", 5, 2010, 2018),
  pterodaktyl: site("pterodaktyl", "pterodaktyl.io", 5, 2016, 2021),
  bound: site("bound", "bound.org", 6, 2005, 2019),
  powerdnz: site("powerdnz", "powerdnz.com", 6, 2005, 2016),
  knut: site("knut", "knut-dns.cz", 6, 2011, 2020),
  openveepeen: site("openveepeen", "openveepeen.net", 6, 2005, 2017),
  anyconnekt: site("anyconnekt", "anyconnekt.sysko.com", 6, 2005, 2016),
  wireguarded: site("wireguarded", "wireguarded.io", 6, 2018),
  vsftpeed: site("vsftpeed", "vsftpeed.org", 6, 2005),
  ownclod: site("ownclod", "ownclod.org", 6, 2010, 2016),
  minnio: site("minnio", "minn.io", 6, 2016, 2021),
  postfixit: site("postfixit", "postfixit.org", 6, 2005),
  backula: site("backula", "backula.org", 6, 2005),
  veeham: site("veeham", "veeham.com", 5, 2008),
  proxmocksBackup: site("proxmocksBackup", "backup.proxmocks.com", 5, 2020),
  mailpig: site("mailpig", "mailpig.io", 6, 2015),
  squirrelmeal: site("squirrelmeal", "squirrelmeal.org", 5, 2005),
  postfixitadmin: site("postfixitadmin", "postfixitadmin.org", 5, 2005, 2016),
};
