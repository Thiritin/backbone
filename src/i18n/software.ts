type Params = Record<string, string | number>;

// Operating systems and software on machines (docs/design/software.md).
export const SOFTWARE_EN: Record<string, (p: Params) => string> = {
  "error.portTaken": () => "Software on this machine already uses one of its ports.",
  "error.wrongOs": () => "This software does not run on this machine's operating system.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "machine" : "machines"}`,
  "ledger.licenseOnce": (p) => `${p.name} license, ${p.machine}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
};
