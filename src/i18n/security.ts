type Params = Record<string, string | number>;
const VULN: Record<string, string> = {
  mopb: "a memory corruption bug in the Zend engine, one of thirty found this month",
  cgi: "a bug that lets a query string pass command line options to PHP-CGI",
  fpm: "a buffer underflow in PHP-FPM that runs code from a crafted URL",
  argv: "an argument injection in PHP-CGI that a soft hyphen can trigger",
};
const vuln = (p: Params) => VULN[p.name] ?? String(p.name);

export const SECURITY_EN: Record<string, (p: Params) => string> = {
  "event.vuln.announced.title": () => "Security vulnerability in PHP",
  "event.vuln.announced.text": (p) => `News outlets report ${vuln(p)}, affecting PHP ${p.versions}. The PHP project confirms it, has no fix yet and expects a patch on ${p.date}.`,
  "event.vuln.poc.title": () => "Proof of concept published",
  "event.vuln.poc.text": (p) => `Someone on Twister posted a working exploit for PHP ${p.versions}, with a screenshot and three fire emojis. It has been reshared 4,000 times.`,
  "event.vuln.warning.title": () => "Federal office warns",
  "event.vuln.warning.text": (p) => `The Bundesamt für Sicherheit in der Informationstechnick reports mass scanning for PHP ${p.versions} and advises taking affected systems offline until the patch is out.`,
  "event.vuln.patch.title": () => "PHP patch released",
  "event.vuln.patch.text": (p) => `The PHP project released the fix for PHP ${p.versions} on the announced date, to general surprise.`,
  "event.vuln.hacked.title": () => "Node compromised",
  "event.vuln.hacked.text": (p) => {
    const leak = `${p.customers} ${Number(p.customers) === 1 ? "customer received" : "customers received"} a data leak notice.`;
    if (p.kind === "mail") return `Attackers took over ${p.device} and are sending spam from it.`;
    const hit = p.kind === "cloud" ? "took over the virtual machines on" : p.kind === "game" ? "took over the game servers on" : "defaced the sites on";
    return `Attackers ${hit} ${p.device} and are sending spam from it. ${leak}`;
  },
  "error.patchPending": () => "The patch for this vulnerability is not out yet.",
  "error.sitesOffline": () => "The sites on this node are already offline.",
  "error.sitesOnline": () => "The sites on this node are already online.",
  "error.notHacked": () => "This node is not compromised.",
};
