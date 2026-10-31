import type { Dict, Params } from "../lang";

const again = (p: Params) => (Number(p.round) > 1 ? "Das ist unsere zweite Mahnung, und der Inhalt ist weiterhin online. " : "");
const second = (p: Params, subject: string) => (Number(p.round) > 1 ? `Zweite Mahnung: ${subject}` : subject);
const host = (p: Params) => String(p.url).replace(/^https:\/\/([^/]+).*$/, "$1");
const duration = (minutes: number): string =>
  minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;

export default {
  "ticket.notice.movie.subject": (p) => second(p, `Urheberrechtsverletzung bei ${host(p)}`),
  "ticket.notice.movie.text": (p) => `${again(p)}Im Auftrag von ${p.sender} haben wir unter ${p.url} eine nicht lizenzierte Kopie eines unserer Filme gefunden. Entferne sie unverzüglich.`,
  "ticket.notice.music.subject": (p) => second(p, `Raubkopierte Musik bei ${host(p)}`),
  "ticket.notice.music.text": (p) => `${again(p)}${p.sender} besitzt die Rechte an den Aufnahmen, die unter ${p.url} zum Download angeboten werden. Entferne sie unverzüglich.`,
  "ticket.notice.youtuber.subject": (p) => second(p, `${host(p)} SOFORT löschen`),
  "ticket.notice.youtuber.text": (p) =>
    `${again(p)}Hier TechTimo, 2,3 Millionen Abonnenten. Die Seite unter ${p.url} nennt mein Video ${p.video} das schlechteste Unboxing des Jahres. Das ist Verleumdung und wahrscheinlich auch ein Urheberrechtsverstoß. Lösch heute noch die ganze Seite.`,
  "ticket.notice.phishing.subject": (p) => second(p, `Phishing-Seite bei ${host(p)}`),
  "ticket.notice.phishing.text": (p) => `${again(p)}Die Seite unter ${p.url} imitiert den Online-Banking-Login von ${p.sender} und sammelt die Passwörter unserer Kunden. Nimm sie offline.`,
  "ticket.notice.spam.subject": (p) => second(p, `Spam-Werbung für ${host(p)}`),
  "ticket.notice.spam.text": (p) => `${again(p)}Dein Netzwerk hat in der letzten Stunde 48.000 Spam-Mails verschickt, alle mit einem Link auf ${p.url}. Stopp den Absender, sonst setzen wir deinen Adressbereich auf die Sperrliste.`,
  "ticket.legal.data.subject": (p) => (Number(p.round) > 1 ? `Gerichtsbeschluss: Daten zu ${host(p)}` : `Auskunftsersuchen zu Kundendaten: ${host(p)}`),
  "ticket.legal.data.text": (p) => Number(p.round) > 1
    ? `Ein Gericht hat die Herausgabe aller Kundendaten und Logs zu ${p.url} angeordnet. Antworte vor Fristablauf, sonst holen Beamte die Hardware persönlich ab.`
    : `Im Rahmen einer Ermittlung fordern wir die Kundendaten, Zugriffslogs und Zahlungsdetails zu ${p.url} an. Antworte vor Fristablauf.`,
  "ticket.legal.takedown.subject": (p) => (Number(p.round) > 1 ? `Gerichtsbeschluss: ${host(p)} offline nehmen` : `Löschanordnung: ${host(p)}`),
  "ticket.legal.takedown.text": (p) => Number(p.round) > 1
    ? `Ein Gericht hat angeordnet, ${p.url} offline zu nehmen. Antworte vor Fristablauf, sonst holen Beamte die Hardware persönlich ab.`
    : `Der Inhalt unter ${p.url} ist Gegenstand einer Ermittlung. Nimm ihn offline und bestätige das vor Fristablauf.`,
  "ticket.refund.outage.subject": () => "Erstattung wegen des Ausfalls",
  "ticket.refund.outage.text": () => "Unsere Seite war stundenlang offline. Wir zahlen für Hosting, das funktioniert, also erwarten wir die Gebühr dieses Monats zurück.",
  "ticket.refund.dataLoss.subject": () => "Alle unsere Daten sind weg",
  "ticket.refund.dataLoss.text": () => "Alles, was wir auf deinem Server hatten, ist verschwunden. Wir wollen die Gebühr dieses Monats zurück und eine Erklärung.",
  "outcome.forwarded": () => "An den Kunden weitergeleitet",
  "outcome.takenDown": () => "Inhalt entfernt",
  "outcome.rejected": () => "Meldung zurückgewiesen",
  "outcome.ignored": () => "Ignoriert",
  "outcome.complied": () => "Anfrage erfüllt",
  "outcome.objected": () => "Widerspruch gesendet",
  "outcome.seized": () => "Frist verpasst, Server beschlagnahmt",
  "outcome.refunded": () => "Einen Monat erstattet",
  "outcome.refused": () => "Erstattung abgelehnt",
  "ledger.refund": (p) => `Erstattung an ${p.customer}`,
  "error.notHosted": () => "Kein Kunde nutzt diese Domain.",
  "event.gridDark.title": () => "Stromausfall",
  "event.gridDark.text": (p) => `${p.location} war ${duration(Number(p.minutes))} ohne Strom.`,
  "event.gridCarried.title": () => "Netzausfall",
  "event.gridCarried.text": (p) => `${p.location} blieb während eines Netzausfalls von ${duration(Number(p.minutes))} online.`,
  "event.feedDark.title": () => "Ausfall einer Einspeisung",
  "event.feedDark.text": (p) => `Einspeisung ${p.feed} von ${p.rack} ist ausgefallen, und die Server waren ${duration(Number(p.minutes))} ohne Strom.`,
  "event.feedCarried.title": () => "Ausfall einer Einspeisung",
  "event.feedCarried.text": (p) => `${p.rack} blieb während eines ${duration(Number(p.minutes))} langen Ausfalls von Einspeisung ${p.feed} online.`,
  "event.coolingFailed.title": () => "Kühlungsausfall",
  "event.coolingFailed.text": (p) => `Die Kühlung in ${p.location} ist für ${duration(Number(p.minutes))} ausgefallen.`,
  "event.overheated.title": () => "Server überhitzt",
  "event.overheated.text": (p) => `${Number(p.count) === 1 ? "1 Server" : `${p.count} Server`} in ${p.location} ${Number(p.count) === 1 ? "hat" : "haben"} sich wegen Hitze abgeschaltet.`,
  "event.feedCascade.title": () => "Ausfall einer Einspeisung",
  "event.feedCascade.text": (p) => `Einspeisung ${p.feed} von ${p.rack} ist ausgefallen, und die andere Einspeisung hat unter der ganzen Last ausgelöst. Alle Server darin waren ${duration(Number(p.minutes))} ohne Strom.`,
  "event.seized.title": () => "Server beschlagnahmt",
  "event.seized.text": (p) => `${p.agency} hat ${p.device} aus ${p.location} mitgenommen.`,
  "event.seizedBack.title": () => "Server zurückgegeben",
  "event.seizedBack.text": (p) => `${p.device} liegt wieder im Lager in ${p.location}.`,
  "review.outage.bad": () => "Stundenlang offline und kein Wort von denen. Nie wieder.",
  "review.outage.ok": () => "Es gab einen Ausfall, aber sie haben ihn in den Griff bekommen.",
  "review.outage.good": () => "Sogar der eine Ausfall wurde gut gehandhabt.",
  "review.dataLoss.bad": () => "Sie haben jede unserer Dateien verloren. Macht eure eigenen Backups.",
  "review.dataLoss.ok": () => "Sie haben unsere Daten verloren, aber das Geld erstattet. Gemischte Gefühle.",
  "review.dataLoss.good": () => "Daten weg, aber sie haben es wiedergutgemacht.",
  "review.fast.bad": () => "Schnelle Kiste, langsamer Support.",
  "review.fast.ok": () => "Der Server ist flott, der Rest ist Durchschnitt.",
  "review.fast.good": () => "Die Tickrate ist kein einziges Mal gefallen. Bester Gameserver, den wir je gemietet haben.",
  "review.smooth.bad": () => "Es lief, aber jeder andere Kontakt mit ihnen war eine Qual.",
  "review.smooth.ok": () => "Keine Beschwerden über die Verfügbarkeit. Sonst nichts Besonderes.",
  "review.smooth.good": () => "Ein ganzer Monat ohne Schluckauf. Genau so sollte Hosting sein.",
} satisfies Dict;
