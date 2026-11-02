// docs/design/plans/panel-ops.md, Components: the parts of the stack a web panel installs for the player.
export type ComponentSlot = "mail" | "ftp" | "web" | "module";

export interface PanelComponent {
  id: string; slot: ComponentSlot; name: string;
  panels: Record<string, number>; // panel family -> first year it offers the component
  until?: number; // first year it is no longer offered
  fee: number; // euro per host and month
  installMinutes: number;
}

export const PANEL_COMPONENTS: PanelComponent[] = [
  { id: "exhim", slot: "mail", name: "Exhim", panels: { cpanic: 2005, directadmen: 2005 }, fee: 0, installMinutes: 20 },
  { id: "postfixit", slot: "mail", name: "Postfixit", panels: { pleskit: 2005, freepanel: 2005 }, fee: 0, installMinutes: 20 },
  { id: "qmeal", slot: "mail", name: "qmeal", panels: { pleskit: 2005 }, until: 2012, fee: 0, installMinutes: 20 },
  { id: "pureeFtpd", slot: "ftp", name: "Purée-FTPd", panels: { cpanic: 2005, directadmen: 2005 }, fee: 0, installMinutes: 10 },
  { id: "proFtpeed", slot: "ftp", name: "ProFTPeed", panels: { cpanic: 2005, pleskit: 2005, directadmen: 2005, freepanel: 2005 }, fee: 0, installMinutes: 10 },
  { id: "vsftpeed", slot: "ftp", name: "vsFTPeed", panels: { freepanel: 2005 }, fee: 0, installMinutes: 10 },
  { id: "apatchy", slot: "web", name: "Apatchy", panels: { cpanic: 2005, pleskit: 2005, directadmen: 2005, freepanel: 2005 }, fee: 0, installMinutes: 30 },
  { id: "enginexApatchy", slot: "web", name: "Enginex + Apatchy", panels: { pleskit: 2012, cpanic: 2017 }, fee: 0, installMinutes: 30 },
  { id: "liteSpeedo", slot: "web", name: "LiteSpeedo", panels: { directadmen: 2010 }, fee: 0, installMinutes: 30 },
  { id: "wordpassToolkit", slot: "module", name: "WordPass Toolkit", panels: { pleskit: 2016, cpanic: 2018 }, fee: 8, installMinutes: 15 },
  { id: "immunofyAv", slot: "module", name: "ImmunofyAV", panels: { cpanic: 2018, pleskit: 2018, directadmen: 2018, freepanel: 2018 }, fee: 4, installMinutes: 15 },
  { id: "spamAssistant", slot: "module", name: "SpamAssistant", panels: { cpanic: 2005, pleskit: 2005, directadmen: 2005, freepanel: 2005 }, fee: 0, installMinutes: 15 },
  { id: "siteBuilder", slot: "module", name: "Site Builder", panels: { pleskit: 2005, cpanic: 2008 }, fee: 5, installMinutes: 15 },
];

export const DEFAULT_COMPONENTS: Record<string, Record<"mail" | "ftp" | "web", string>> = {
  cpanic: { mail: "exhim", ftp: "pureeFtpd", web: "apatchy" },
  pleskit: { mail: "postfixit", ftp: "proFtpeed", web: "apatchy" },
  directadmen: { mail: "exhim", ftp: "proFtpeed", web: "apatchy" },
  freepanel: { mail: "postfixit", ftp: "proFtpeed", web: "apatchy" },
};

export const componentById = (id: string): PanelComponent | undefined => PANEL_COMPONENTS.find((x) => x.id === id);

// Whether a panel family offers the component in a year.
export const componentOffered = (x: PanelComponent, family: string, year: number): boolean =>
  x.panels[family] !== undefined && x.panels[family] <= year && (x.until === undefined || year < x.until);
