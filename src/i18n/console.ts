type Params = Record<string, string | number>;

// docs/design/software.md, sections 4 and 6: the OS install, the machine's console and software installed from its shell.
export const CONSOLE_EN: Record<string, (p: Params) => string> = {
  "error.unknownOs": () => "There is no such operating system.",
  "error.otherMedia": () => "The loaded ISO holds another operating system.",
  "error.noOs": () => "Install an operating system on this machine first.",
  "error.osNotUp": () => "The machine's operating system is not running.",
  "error.notVmwhere": () => "The App Suite is sold for VMwhere clusters.",
  "error.noAppSuite": () => "This cluster has no App Suite.",
  "error.hasAppSuite": () => "This cluster already has the App Suite.",
  "term.console.notFound": () => "Operating system not found",
  "term.console.osInstall": () => "Installing the system...",
};
