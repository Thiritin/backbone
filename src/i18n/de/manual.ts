import { euroCents } from "../../sim/00-core/money";
import { t } from "../en";
import type { Dict, Params } from "../lang";

const gb = (x: string | number) => `${x} GB`;
const mailboxes = (n: string | number) => `${n} ${Number(n) === 1 ? "Postfach" : "Postfächer"}`;
const web = (p: Params) => `${gb(p.disk)} Speicherplatz, ${gb(p.traffic)} Traffic im Monat und ${mailboxes(p.mail)}`;
const box = (p: Params) => `${p.cpu} vCPU${Number(p.cpu) === 1 ? "" : "s"}, ${gb(p.ram)} RAM und ${gb(p.disk)} Festplatte`;
const cards = (p: Params) => `${p.gpu} GPU${Number(p.gpu) === 1 ? "" : "s"}`;
const domain = (p: Params) => (Number(p.owned) ? `Ich besitze ${p.domain} schon und würde sie gern zu dir umziehen.${p.auth ? ` Der Auth-Code lautet ${p.auth}.` : ""}` : `Registrier bitte auch ${p.domain} für mich.`);
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} und ${xs.at(-1)}` : xs[0] ?? "mehr Platz");
const more = (p: Params) => (p.product === "webHosting"
  ? `${gb(p.disk0)} bis ${gb(p.disk1)} Speicherplatz, ${gb(p.traffic0)} bis ${gb(p.traffic1)} Traffic und ${p.mail0} bis ${mailboxes(p.mail1)}`
  : and([
    Number(p.cpu1) > 0 && `${p.cpu0} bis ${p.cpu1} vCPUs`, Number(p.ram1) > 0 && `${gb(p.ram0)} bis ${gb(p.ram1)} RAM`, Number(p.disk1) > 0 && `${gb(p.disk0)} bis ${gb(p.disk1)} Festplatte`,
  ].filter((x): x is string => !!x)));

export default {
  "order.msg.webHosting.0": (p) => `Hallo, ich brauche Webhosting für ${p.domain}: etwa ${web(p)}. ${domain(p)}`,
  "order.msg.webHosting.1": (p) => `Ein Freund hat dich empfohlen. Meine Website ${p.domain} braucht ${web(p)}. ${domain(p)} Was würde das kosten?`,
  "order.msg.vps.0": (p) => `Ich hätte gern einen VPS in ${p.city} mit ${box(p)}. Root-Zugriff, bitte. Ich weiß, was ich tue.`,
  "order.msg.vps.1": (p) => `Richte mir bitte einen virtuellen Server ein: ${box(p)}. Debiant wäre schön, und monatliche Abrechnung.`,
  "order.msg.gameServer.0": (p) => `Wir brauchen einen Gameserver für unseren Clan mit ${box(p)}. Er muss bis Freitagabend laufen.`,
  "order.msg.gameServer.1": (p) => `Richte bitte einen Gameserver in ${p.city} ein: ${box(p)}. Niedriger Ping ist uns wichtiger als alles andere.`,
  "order.msg.gpu.0": (p) => `Ich hätte gern einen GPU-Server in ${p.city} mit ${cards(p)}, ${box(p)}. Ich brauche ihn, um meine Modelle zu trainieren.`,
  "order.msg.gpu.1": (p) => `Richte mir bitte einen virtuellen Server mit ${cards(p)} ein: ${box(p)}. CUDA-Treiber wären schön, und monatliche Abrechnung.`,
  "sales.msg.upgrade": (p) => `Wir stoßen ständig an unsere Grenzen. Wir brauchen ${more(p)}. Was würde uns das Upgrade kosten?`,
  "sales.you.upgrade": (p) => `Das Upgrade können wir für insgesamt ${euroCents(Number(p.price))} im Monat machen.`,
  "sales.you.upgradeDone": (p) => `Das Upgrade ist live. Dein Dienst läuft ab jetzt mit den neuen Ressourcen für ${euroCents(Number(p.price))} im Monat.`,
  "ticket.upgrade.more.subject": (p) => `${p.hostname || p.service || "Mein Dienst"} wird zu klein`,
  "ticket.upgrade.more.text": () => "Uns geht ständig der Platz aus. Was würde uns das Upgrade kosten?",
  "invoice.line.firstMonth": (p) => `${p.label}, erster Monat`,
  "invoice.line.setupFee": (p) => `${p.label}, Einrichtungsgebühr`,
  "invoice.line.domain": (p) => `Domain ${p.domain}, erstes Jahr`,
  "invoice.line.domainTransfer": (p) => `Umzug von ${p.domain}`,
  "invoice.line.domainRenewal": (p) => `Domain ${p.domain}, ein weiteres Jahr`,
  "ledger.domain": (p) => `${p.domain} bei ${p.registry}`,
  "ledger.domainTransfer": (p) => `Umzug von ${p.domain} zu ${p.registry}`,
  "ledger.domainRenewal": (p) => `Verlängerung von ${p.domain} bei ${p.registry}`,
  "activity.renewDomain": (p) => `${p.domain} um ein Jahr verlängert`,
  "activity.changePackage": (p) => `Auf Paket ${p.pkg} umgestellt`,
  "activity.upgrade": (p) => `Dienst für ${euroCents(Number(p.price))} im Monat aufgerüstet`,
  "event.orderAccepted.title": () => "Angebot angenommen",
  "event.orderAccepted.text": (p) => `${p.name} hat das Angebot angenommen.`,
  "event.orderPaid.title": () => "Bestellung bezahlt",
  "event.orderPaid.text": (p) => `${p.name} hat die Rechnung der Bestellung bezahlt und wartet auf die Einrichtung.`,
  "event.stepFailed.title": () => "Bestellschritt fehlgeschlagen",
  "event.stepFailed.text": (p) => `${p.name}: ${t(String(p.error))}`,
  "event.domainExpiring.title": () => "Domain läuft bald ab",
  "event.domainExpiring.text": (p) => `${p.domain} läuft in ${p.days} Tagen ab.`,
  "event.domainExpired.title": () => "Domain abgelaufen",
  "event.domainExpired.text": (p) => `${p.domain} ist abgelaufen und die Website ist offline.`,
  "lost.unpaid": () => "Nie bezahlt",
  "error.needsQuote": () => "Der Kunde hat noch kein Angebot angenommen.",
  "error.quoteSent": () => "Der Kunde hat das Angebot noch nicht beantwortet.",
  "error.needsAutomation": () => "Wähle einen Host für die Einrichtung.",
  "error.needsAccount": () => "Lege zuerst das Kundenkonto an.",
  "error.addressMissing": () => "Gib die vollständige Adresse ein.",
  "error.quoteSentAlready": () => "Dieses Angebot ist schon verschickt.",
  "error.quoteOtherOrder": () => "Dieses Angebot gehört zu einer anderen Bestellung.",
  "error.quoteNotAccepted": () => "Der Kunde hat dieses Angebot nicht angenommen.",
  "error.needsInvoice": () => "Bestätige zuerst die Bestellung und sende die Rechnung.",
  "error.needsDomain": () => "Registriere zuerst die Domain.",
  "error.stepDone": () => "Dieser Schritt ist erledigt.",
  "error.domainTaken": () => "Diese Domain gehört einem anderen Kunden.",
  "error.unknownDomain": () => "Diese Domain ist für keinen aktiven Kunden registriert.",
  "error.routeElsewhere": () => "Dieser Cluster steht in einer anderen Stadt.",
} satisfies Dict;
