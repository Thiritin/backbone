import type { Dict, Params } from "../lang";

const VULN: Record<string, string> = {
  mopb: "eine Speicherbeschädigung in der Zend-Engine, eine von dreißig in diesem Monat gefundenen",
  cgi: "einen Fehler, durch den ein Query-String Kommandozeilenoptionen an PHP-CGI weiterreichen kann",
  fpm: "einen Buffer-Underflow in PHP-FPM, der Code aus einer präparierten URL ausführt",
  argv: "eine Argument-Injection in PHP-CGI, die ein weicher Trennstrich auslösen kann",
};
const vuln = (p: Params) => VULN[p.name] ?? String(p.name);

export default {
  "event.vuln.announced.title": () => "Sicherheitslücke in PHP",
  "event.vuln.announced.text": (p) => `Nachrichtenportale berichten über ${vuln(p)}, betroffen ist PHP ${p.versions}. Das PHP-Projekt bestätigt das, hat noch keinen Fix und erwartet einen Patch am ${p.date}.`,
  "event.vuln.poc.title": () => "Proof of Concept veröffentlicht",
  "event.vuln.poc.text": (p) => `Jemand auf Twister hat einen funktionierenden Exploit für PHP ${p.versions} gepostet, mit Screenshot und drei Feuer-Emojis. Er wurde 4.000-mal geteilt.`,
  "event.vuln.warning.title": () => "Bundesamt warnt",
  "event.vuln.warning.text": (p) => `Das Bundesamt für Sicherheit in der Informationstechnick meldet Massenscans nach PHP ${p.versions} und rät, betroffene Systeme bis zum Patch vom Netz zu nehmen.`,
  "event.vuln.patch.title": () => "PHP-Patch veröffentlicht",
  "event.vuln.patch.text": (p) => `Das PHP-Projekt hat den Fix für PHP ${p.versions} zum angekündigten Termin veröffentlicht, zur allgemeinen Überraschung.`,
  "event.vuln.hacked.title": () => "Node kompromittiert",
  "event.vuln.hacked.text": (p) => {
    const leak = `${p.customers} ${Number(p.customers) === 1 ? "Kunde hat" : "Kunden haben"} eine Datenleck-Benachrichtigung erhalten.`;
    if (p.kind === "mail") return `Angreifer haben ${p.device} übernommen und verschicken darüber Spam.`;
    const hit = p.kind === "cloud" ? "haben die virtuellen Maschinen auf" : p.kind === "game" ? "haben die Gameserver auf" : "haben die Websites auf";
    return `Angreifer ${hit} ${p.device} übernommen und verschicken darüber Spam. ${leak}`;
  },
  "error.patchPending": () => "Der Patch für diese Schwachstelle ist noch nicht da.",
  "error.sitesOffline": () => "Die Websites auf diesem Node sind bereits offline.",
  "error.sitesOnline": () => "Die Websites auf diesem Node sind bereits online.",
  "error.notHacked": () => "Dieser Node ist nicht kompromittiert.",
} satisfies Dict;
