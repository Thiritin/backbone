import type { Dict, Params } from "../lang";

const ITEM: Record<string, [string, string]> = {
  gameServer: ["Gameserver", "Gameserver"], vps: ["vServer", "vServer"], storage: ["Speicher-Volume", "Speicher-Volumes"], webHosting: ["Webspace", "Webspaces"],
};
const what = (p: Params) => {
  const [one, many] = ITEM[String(p.product)];
  const each = Number(p.count) === 1 ? "" : "je ";
  const size = p.product === "storage" || p.product === "webHosting" ? `${each}${p.diskGb} GB Speicherplatz` : `${each}${p.vcpu} vCPU und ${p.ramGb} GB RAM`;
  return `${p.count} ${Number(p.count) === 1 ? one : many} mit ${size}`;
};
const span = (p: Params) => ({ 3: "das Wochenende", 7: "eine Woche", 90: "drei Monate", 365: "ein Jahr" })[Number(p.days) as 3] ?? `${p.days} Tage`;
const PEOPLE: Record<string, string> = { gamer: "Gamer", private: "Privatnutzer", hobbyDev: "Entwickler" };
const term = (p: Params) => (Number(p.months) === 1 ? "einen Monat" : `${p.months} Monate`);
const ask = (p: Params) => `${what(p)} für ${term(p)}, ${Number(p.free) ? "kostenlos" : "zum halben Preis"}`;
const reach = (p: Params) => `${p.audience} ${PEOPLE[String(p.profile)]}`;
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ticket.sponsor.lanTastic.subject": (p) => `${p.event} braucht Server`,
  "ticket.sponsor.lanTastic.text": (p) => `Hallo, wir veranstalten ${p.event}, die größte LAN-Party im Landkreis, und letztes Jahr haben die Server stärker gelaggt als unsere Spieler. Könntest du ${what(p)} für ${span(p)} sponsern? Dein Logo kommt auf die große Leinwand, zwischen die Pizzapausen.`,
  "ticket.sponsor.chaosClub.subject": (p) => `${p.event}-Treffen`,
  "ticket.sponsor.chaosClub.text": (p) => `Wir treffen uns jeden Donnerstag, um Dinge auseinanderzunehmen, die eigentlich gut funktioniert haben. Ein Host für unsere Tools wäre toll: ${what(p)} für ${span(p)}. Bezahlen können wir nicht, aber wir sagen dir, was wir finden.`,
  "ticket.sponsor.hackASorus.subject": (p) => `Hackathon ${p.event}`,
  "ticket.sponsor.hackASorus.text": (p) => `Vierzig Entwickler, ein Wochenende, zu wenig Schlaf. Wir brauchen ${what(p)} für ${span(p)}, um die Beiträge laufen zu lassen. Nichts geht in Produktion, und was wir kaputt machen, bleibt in der Sandbox.`,
  "ticket.sponsor.mirror.subject": (p) => `Mirror für ${p.event}`,
  "ticket.sponsor.mirror.text": (p) => `Unsere Distribution sucht einen Mirror in der Nähe ihrer Nutzer. Wir bräuchten ${what(p)} für ${span(p)}. Deine Firma steht dafür auf unserer Mirror-Seite, zwischen einer Universität und einem Mann namens Gerhard.`,
  "ticket.sponsor.fragFest.subject": (p) => `Turnier ${p.event}`,
  "ticket.sponsor.fragFest.text": (p) => `Das Finale von ${p.event} steht an, und die alten Server werden von Kabelbindern zusammengehalten. Wir suchen ${what(p)} für ${span(p)}. Der Name des Sponsors wird vor jedem Match ausgerufen, also bitte keinen Ausfall.`,
  "ticket.sponsor.userGroup.subject": (p) => `Website für ${p.event}`,
  "ticket.sponsor.userGroup.text": (p) => `Unsere Gruppe trifft sich seit den Neunzigern, und unsere Website lebt die meiste Zeit im Keller eines Mitglieds. Könntest du uns ${what(p)} für ${span(p)} geben? Wir nennen dich als Sponsor, gleich unter dem Sitzungsprotokoll.`,
  "ticket.sponsor.codeClub.subject": (p) => `Websites für ${p.event}`,
  "ticket.sponsor.codeClub.text": (p) => `Unsere Schüler bauen dieses Jahr ihre ersten Websites und würden sie gern richtig online stellen. Könntest du ${what(p)} für ${span(p)} sponsern? Wir bedanken uns auf jeder Seite bei dir.`,
  "ticket.sponsor.shelter.subject": (p) => `Ein Zuhause für die Website von ${p.event}`,
  "ticket.sponsor.shelter.text": (p) => `Wir vermitteln Katzen, Hunde und einen sehr lauten Papagei, und unsere Website braucht auch ein Zuhause. Könntest du ${what(p)} für ${span(p)} sponsern? Dein Logo käme neben die Vermittlungsliste.`,
  "ticket.sponsor.pixelJam.subject": (p) => `${p.event} braucht einen Spielplatz`,
  "ticket.sponsor.pixelJam.text": (p) => `Bei ${p.event} bauen Teams in einem Wochenende ein Spiel, und am Sonntag spielt jeder die Ergebnisse. Wir brauchen ${what(p)} für ${span(p)}, damit der Playtest nicht abstürzt.`,
  "ticket.sponsor.openData.subject": (p) => `Speicher für ${p.event}`,
  "ticket.sponsor.openData.text": (p) => `Wir sammeln öffentliche Datensätze der Stadt und machen eine Woche lang Karten und Tools daraus. Könntest du ${what(p)} für ${span(p)} sponsern, um die Rohdaten abzulegen?`,
  "ticket.sponsor.devOops.subject": (p) => `Streaming für ${p.event}`,
  "ticket.sponsor.devOops.text": (p) => `Wir erwarten zweitausend Teilnehmer und eine Keynote, die nicht buffern darf. Wir brauchen ${what(p)} für ${span(p)}, um die Vorträge zu streamen. Die Redner erwähnen dich mindestens einmal, meistens aus Versehen.`,
  "outcome.sponsored": () => "Sponsoring angenommen",
  "outcome.sponsorDeclined": () => "Sponsoring abgelehnt",
  "review.sponsor.bad": () => "Ihr Logo war auf der großen Leinwand, ihre Server nicht.",
  "review.sponsor.ok": () => "Ein Sponsor, der aufgetaucht ist. Meistens.",
  "review.sponsor.good": () => "Gratis-Server, die das ganze Wochenende liefen. Das merken wir uns.",
  "event.sponsorRequest.title": () => "Sponsoring-Anfrage",
  "event.sponsorRequest.text": (p) => `${p.event} sucht einen Sponsor.`,
  "event.sponsorDone.title": (p) => `${p.event} ist vorbei`,
  "event.sponsorDone.text": (p) => {
    const gains = [
      Number(p.knowHow) > 0 && `${p.knowHow} Know-how`,
      Number(p.awareness) > 0 && `${p.awareness} % mehr Bekanntheit`,
      Number(p.leads) > 0 && `${p.leads} ${plural(p.leads, "Lead", "Leads")}`,
      Number(p.stars) > 0 && `eine ${p.stars}-Sterne-Bewertung`,
      Number(p.recommendation) > 0 && "eine Empfehlung für eine qualifizierte Fachkraft",
    ].filter(Boolean);
    return `Die Server für ${p.event} sind oben geblieben. Du erhältst ${gains.length ? gains.join(", ") : "ein Dankeschön"}.`;
  },
  "ticket.sponsor.board.clan.subject": (p) => `Bewerbung von ${p.event}`,
  "ticket.sponsor.board.clan.text": (p) => `Hier ist ${p.event}. In unserem Clan sind ${reach(p)}, die sich noch nie auf etwas geeinigt haben, außer auf Lag. Wir haben dein Angebot bei Sponsor-Bored gesehen und hätten gern ${ask(p)}. Dein Banner kommt auf die Startseite unserer Website.`,
  "ticket.sponsor.board.lanParty.subject": (p) => `Bewerbung von ${p.event}`,
  "ticket.sponsor.board.lanParty.text": (p) => `Wir veranstalten ${p.event} in einer gemieteten Turnhalle für ${reach(p)} und eine gefährliche Menge Kabel. Wir hätten gern ${ask(p)}. Wir erwähnen dich auf der Bühne, zwischen den Pizzalieferungen.`,
  "ticket.sponsor.board.fanSite.subject": (p) => `Bewerbung von ${p.event}`,
  "ticket.sponsor.board.fanSite.text": (p) => `${p.event} wird jeden Monat von ${reach(p)} gelesen, meist nachts. Wir hätten gern ${ask(p)}. Dein Banner steht oben auf jeder Seite, direkt über den Streitereien.`,
  "ticket.sponsor.board.student.subject": (p) => `Bewerbung von ${p.event}`,
  "ticket.sponsor.board.student.text": (p) => `Wir sind ein Studentenprojekt mit ${reach(p)} im Kurs, und unser Professor sagt, die Demo muss irgendwo Echtes laufen. Wir hätten gern ${ask(p)}. Dein Name kommt in jede Forensignatur des Teams.`,
  "ticket.sponsor.board.mirror.subject": (p) => `Bewerbung von ${p.event}`,
  "ticket.sponsor.board.mirror.text": (p) => `Wir spiegeln Open-Source-Software für ${reach(p)}, die sie lieber selbst kompilieren würden. Wir hätten gern ${ask(p)}. Jeder Maintainer beendet seine Forenbeiträge mit einem Dank an dich.`,
  "event.boardApplication.title": () => "Sponsoring-Bewerbung",
  "event.boardApplication.text": (p) => `${p.event} hat sich um ein Sponsoring beworben.`,
  "event.halfAccepted.title": (p) => `${p.event} nimmt dein Angebot an`,
  "event.halfAccepted.text": (p) => `${p.event} hat dein Angebot mit 50 % Rabatt angenommen, und die Dienste laufen.`,
  "event.halfDeclined.title": (p) => `${p.event} wählt einen anderen Sponsor`,
  "event.halfDeclined.text": (p) => `${p.event} hat dein Angebot mit 50 % Rabatt abgelehnt.`,
  "event.boardDropped.title": (p) => `${p.event} entfernt dein Banner`,
  "event.boardDropped.text": (p) => `${p.event} hat dein Banner abgehängt, das Sponsoring bringt also keine Bekanntheit und keine Leads mehr.`,
  "event.boardDone.title": (p) => `${p.event} ist vorbei`,
  "event.boardDone.text": (p) => `Das Sponsoring von ${p.event} ist beendet.`,
  "error.badOffer": () => "Dieses Angebot kann nicht eingestellt werden.",
  "error.offersOpen": () => "Es sind bereits drei Angebote offen.",
  "error.unknownOffer": () => "Dieses Angebot ist nicht mehr offen.",
  "error.offerFull": () => "Alle Plätze dieses Angebots sind vergeben.",
  "ticket.sponsor.board.held.subject": (p) => `${p.event}: unser Server ist offline`,
  "ticket.sponsor.board.held.text": () => `Hallo, unser Server ist plötzlich offline. Wir haben euer Banner nur für das neue Layout abgenommen, das ist doch kein Grund, uns zu sperren? Bitte schaltet ihn wieder frei.`,
  "error.sponsorNotDropped": () => "Dieses Sponsoring zeigt dein Banner noch.",
  "event.sponsorFailed.title": (p) => `Bei ${p.event} ist etwas schiefgegangen`,
  "event.sponsorFailed.text": (p) => `Die Server für ${p.event} waren ${p.hours} ${plural(p.hours, "Stunde", "Stunden")} lang down. Zwei schlechte Bewertungen wurden veröffentlicht, und deine Bekanntheit ist gesunken.`,
} satisfies Dict;
