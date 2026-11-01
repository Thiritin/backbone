import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const SLA: Record<string, string> = { basic: "Basic", business: "Business", premium: "Premium" };
const sla = (p: Params) => (p.sla === "basic" ? "" : ` Wir brauchen den SLA ${SLA[p.sla] ?? p.sla}.`);
const price = (p: Params) => euroCents(Number(p.price));
const web = (p: Params) => `${p.disk} GB Speicherplatz und ${p.mail} ${Number(p.mail) === 1 ? "Postfach" : "Postfächer"}`;
const cards = (p: Params) => `${p.gpu} GPU${Number(p.gpu) === 1 ? "" : "s"}`;
const box = (p: Params) => `${p.cpu} vCPU, ${p.ram} GB RAM und ${p.disk} GB Festplatte`;

const STUDY_NAME: Record<string, string> = {
  private: "Privatpersonen", gamer: "Gamer", hobbyDev: "Hobbyentwickler", soleProp: "Einzelunternehmer", smallBiz: "Kleinunternehmen",
  agency: "Agenturen und Startups", office: "Arzt- und Anwaltspraxen", onlineShop: "Onlineshops", enterprise: "Konzerne",
};

export default {
  "request.use.private": () => "Es ist nur eine kleine private Seite, also eilt nie etwas.",
  "request.use.gamer": () => "Wir zocken fast jeden Abend und das ganze Wochenende, dann muss alles laufen.",
  "request.use.hobbyDev": () => "Es ist ein Nebenprojekt, an dem ich herumbastle, wenn ich Zeit finde.",
  "request.use.soleProp": () => "Kunden finden mich über die Website, und ich schaue alle paar Tage rein.",
  "request.use.smallBiz": () => "Unser Team arbeitet jeden Tag während der Bürozeiten damit.",
  "request.use.agency": () => "Unsere Kunden sind den ganzen Tag drauf, also merken wir Probleme schnell.",
  "request.use.office": () => "Patienten buchen jeden Morgen ihre Termine darüber.",
  "request.use.onlineShop": () => "Bestellungen kommen rund um die Uhr, jede Minute offline kostet uns Geld.",
  "request.use.enterprise": () => "Unsere Belegschaft verlässt sich rund um die Uhr darauf.",
  "sales.msg.webHosting.0": (p) => `Hallo, ich suche ein Zuhause für ${p.domain || "meine Website"}: etwa ${web(p)}. Was würde das im Monat kosten?${sla(p)}`,
  "sales.msg.webHosting.1": (p) => `Ein Freund hat dich empfohlen. Wir brauchen ${web(p)} für ${p.domain || "unsere Seite"}, wenn möglich gehostet in ${p.city}.${sla(p)} Was ist dein Preis?`,
  "sales.msg.vps.0": (p) => `Wir brauchen einen vServer mit ${box(p)} und Root-Zugriff in ${p.city}.${sla(p)} Bitte schick mir deinen Monatspreis.`,
  "sales.msg.vps.1": (p) => `Unsere App ist aus dem Shared Hosting herausgewachsen. Kannst du einen vServer mit ${box(p)} anbieten?${sla(p)} Monatliche Abrechnung wäre uns am liebsten.`,
  "sales.msg.gameServer.0": (p) => `Unser Clan braucht einen Gameserver mit ${box(p)}, der freitagabends nicht laggt. Wie viel kostet das im Monat?`,
  "sales.msg.gameServer.1": (p) => `Wir suchen einen Gameserver mit ${box(p)} in der Nähe von ${p.city} für niedrigen Ping. Was verlangst du?`,
  "sales.msg.dedicated.0": (p) => `Wir suchen einen Dedicated Server mit mindestens ${p.ram} GB RAM in ${p.city} mit zwölf Monaten Laufzeit.${sla(p)} Bitte nenn uns einen Monatspreis.`,
  "sales.msg.dedicated.1": (p) => `Unser Team will eigene Hardware. Könntest du einen Server mit mindestens ${p.ram} GB RAM bereitstellen?${sla(p)}`,
  "sales.msg.gpu.0": (p) => `Wir trainieren Modelle und brauchen ${cards(p)} mit ${box(p)} in ${p.city}.${sla(p)} Was würde das im Monat kosten?`,
  "sales.msg.gpu.1": (p) => `Unser Team braucht GPU-Server für Rendering und Inferenz: ${cards(p)}, ${box(p)}.${sla(p)} Bitte schick uns deinen Monatspreis.`,
  "sales.msg.shady": (p) => `Wir brauchen heute einen vServer mit ${box(p)}. Viel Traffic, keine Fragen, kein Papierkram. Wir zahlen in Krypto, immer pünktlich. Nenn deinen Preis.`,
  "sales.msg.discount": (p) => `In deiner Kampagne standen ${p.discount} % Rabatt für Agenturen. Das würden wir gern in Anspruch nehmen.`,
  "sales.reply.accept": (p) => `Das passt für uns. Bitte richte es ein. Viele Grüße, ${p.name}`,
  "sales.reply.counter": (p) => `Das liegt etwas über unserem Budget. Wir könnten ${price(p)} im Monat zahlen. Sag Bescheid.`,
  "sales.reply.noBudget": (p) => `Danke, aber dafür fehlt uns das Budget. Wir suchen einen anderen Anbieter. ${p.name}`,
  "sales.reply.refused": (p) => `Danke für das Angebot. Wir haben woanders ein besseres gefunden. ${p.name}`,
  "sales.you.decline": () => "Danke für dein Interesse. Wir können das im Moment leider nicht übernehmen.",
  "sales.need.location": (p) => `Braucht einen Standort in ${p.city}`,
  "sales.need.age": (p) => `Braucht ein Unternehmen, das mindestens ${p.months} Monate alt ist`,
  "sales.need.reviews": (p) => `Braucht eine Bewertung von mindestens ${p.stars} Sternen`,
  "sales.req.location": (p) => `Standort in ${p.city}`,
  "sales.req.cluster": (p) => `Cluster in ${p.city}`,
  "sales.req.server": (p) => `Freier Server in ${p.city}`,
  "sales.req.datacenter": (p) => `Rechenzentrum in ${p.city}`,
  "sales.req.age": (p) => `Unternehmen mindestens ${p.months} Monate alt`,
  "sales.req.reviews": (p) => `Bewertung von ${p.stars} Sternen`,
  "lost.expired": () => "Nicht rechtzeitig geantwortet",
  "lost.noFittingProduct": () => "Kein passendes Paket",
  "lost.price": () => "Zu teuer",
  "lost.declined": () => "Abgelehnt",
  "lost.noCapacity": (p) => `Keine Kapazität in ${p.city}`,
  "event.salesWon.title": () => "Deal gewonnen",
  "event.salesWon.text": (p) => `${p.name} hat für ${p.spec} zu ${price(p)} im Monat unterschrieben.`,
  "event.salesCounter.title": () => "Gegenangebot",
  "event.salesCounter.text": (p) => `${p.name} bietet ${price(p)} im Monat.`,
  "event.salesRefused.title": () => "Angebot abgelehnt",
  "event.salesRefused.text": (p) => `${p.name} hat dein Angebot abgelehnt.`,
  "error.unknownRequest": () => "Diese Anfrage ist nicht mehr offen.",
  "error.quotePrice": () => "Gib einen Monatspreis über null ein.",
  "error.requestMissing": () => "Diese Anfrage kannst du noch nicht bedienen.",
  "error.yearlyPrice": () => "Jahresprodukte behalten ihren Preis bis zur Verlängerung.",
  "error.unknownProfile": () => "Diese Kundengruppe gibt es nicht.",
  "error.studyDone": () => "Diese Studie hast du bereits.",
  "ledger.marketStudy": (p) => `Marktstudie von Gartnah: ${STUDY_NAME[p.profile] ?? p.profile}`,
  "sales.msg.transfer": (p) => `Meine Seite läuft derzeit bei ${p.host}. Bitte zieht sie für mich um.`,
} satisfies Dict;
