import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import type { Dict, Params } from "../lang";

type Mail = (p: Params) => string;
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const hi = (p: Params) => (p.name ? `Hallo ${p.name},` : "Hallo,");
const SIGN: Mail[] = [
  (p) => `Viele Grüße\nDein ${p.company}-Team`,
  (p) => `Beste Grüße\n${p.company} Support\nsupport@${p.host}`,
  (p) => `Freundliche Grüße\nDein ${p.company}-Kundenservice`,
];
const to = (greet: Mail) => (i: number, body: Mail): Mail => (p) => `${greet(p)}\n\n${body(p)}\n\n${SIGN[i](p)}`;
const customer = to(hi), sender = to(() => "Sehr geehrte Damen und Herren,"), lead = to((p) => `Guten Tag ${p.name},`);
const siteOf = (p: Params) => new URL(String(p.url)).hostname;
const site = (p: Params) => p.domain || p.service || "deine Website";
const svc = (p: Params) => p.hostname || p.service || "dein Dienst";
const day = (p: Params) => {
  const d = dateOf(Number(p.hour));
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]} um ${String(d.getUTCHours()).padStart(2, "0")}:00 Uhr`;
};
const setupFee = (p: Params) => (Number(p.setup) > 0 ? ` zuzüglich einer einmaligen Einrichtungsgebühr von ${euroCents(Number(p.setup))}` : "");
const hosting = (p: Params) => (p.domain ? `${p.line} für ${p.domain}` : p.line);
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);
const domainLine = (p: Params) => (Number(p.owned) ? `Der Umzug von ${p.domain} zu uns ist abgeschlossen, und wir kümmern uns ab jetzt um die Verlängerungen.` : `Wir haben ${p.domain} für dich registriert.`);

const MAILS: Record<string, [Mail, Mail, Mail]> = {
  "tpl.ack": [
    (p) => `Danke für den Hinweis. Wir wissen, dass ${svc(p)} nicht erreichbar ist, und unsere Techniker arbeiten gerade daran. Wir melden uns, sobald es wieder läuft.`,
    (p) => `Wir bestätigen den Ausfall von ${svc(p)}. Die Ursache wird schon behoben, und du hörst von uns, sobald alles wieder läuft.`,
    (p) => `Entschuldige die Unterbrechung. ${svc(p)} ist bei uns ausgefallen, und die Reparatur läuft. Du musst nichts tun.`,
  ],
  "tpl.back": [
    (p) => `${svc(p)} ist wieder online und läuft normal. Wir entschuldigen uns für die Unterbrechung.`,
    (p) => `Gute Nachricht: Das Problem ist behoben, und ${svc(p)} antwortet wieder. Danke für deine Geduld.`,
    (p) => `Der Ausfall ist vorbei, und ${svc(p)} ist wieder erreichbar. Sag uns bitte Bescheid, falls noch etwas nicht stimmt.`,
  ],
  "tpl.askDetails": [
    () => "Danke für deine Nachricht. Kannst du uns etwas genauer beschreiben, was du siehst, am besten mit der genauen Fehlermeldung und der Uhrzeit?",
    () => "Wir helfen dir gern. Kannst du uns einen Screenshot oder den genauen Wortlaut der Meldung schicken?",
    () => "Um das richtig zu prüfen, brauchen wir ein paar Details. Was hast du gemacht, als es passiert ist, und was hast du gesehen?",
  ],
  "tpl.ftp": [
    (p) => `Verbinde dich mit einem FTP-Client wie FileZilla mit ftp.${p.host}, melde dich mit deinen Panel-Zugangsdaten an und kopiere deine Dateien in den Ordner htdocs von ${site(p)}. Sie sind sofort online.`,
    (p) => `Du kannst deine Seiten per FTP hochladen: Der Server ist ftp.${p.host}, Benutzername und Passwort sind deine Panel-Zugangsdaten. Alles im Ordner htdocs erscheint auf ${site(p)}.`,
    (p) => `Am schnellsten geht es per FTP. Richte dein FTP-Programm auf ftp.${p.host} aus, melde dich mit deinen Panel-Daten an und leg die Dateien in htdocs ab. ${site(p)} zeigt sie sofort an.`,
  ],
  "tpl.mail": [
    (p) => `Trag mail.${p.host} als Posteingangs- und Postausgangsserver ein, mit deiner vollständigen E-Mail-Adresse als Benutzername sowie Port 993 für IMAP und 587 zum Senden.`,
    (p) => `Der Servername für ein- und ausgehende E-Mails ist mail.${p.host}. Nutze deine vollständige E-Mail-Adresse als Benutzername und dein Postfach-Passwort.`,
    (p) => `Wähle in Outlook IMAP und gib für beide Server mail.${p.host} ein. Der Benutzername ist deine vollständige Adresse${p.domain ? ` bei ${p.domain}` : ""}.`,
  ],
  "tpl.dns": [
    (p) => `Trag bei deinem Registrar ns1.${p.host} und ns2.${p.host} als Nameserver für ${site(p)} ein. Es kann bis zu einen Tag dauern, bis die Änderung überall angekommen ist.`,
    (p) => `Ersetze bei dem Registrar, bei dem du ${site(p)} gekauft hast, die Nameserver durch ns1.${p.host} und ns2.${p.host}. Innerhalb eines Tages zeigt die Domain deine Seite.`,
    (p) => `${p.domain ? `${p.domain} muss` : "Deine Domain muss"} auf uns zeigen: Trag bei deinem Registrar ns1.${p.host} und ns2.${p.host} als Nameserver ein. Das dauert meist ein paar Stunden, höchstens einen Tag.`,
  ],
  "tpl.panel": [
    (p) => `Wir haben ein neues Passwort für das Kundenpanel an deine Kontaktadresse geschickt. Du kannst dich unter panel.${p.host} anmelden.`,
    (p) => `Ein neues Panel-Passwort ist unterwegs in dein Postfach. Die Anmeldeseite ist panel.${p.host}.`,
    (p) => `Wir haben deinen Panel-Zugang zurückgesetzt und dir das neue Passwort per E-Mail geschickt. Melde dich bitte unter panel.${p.host} an und ändere es.`,
  ],
  "tpl.ssl": [
    (p) => `Wir können ein SSL-Zertifikat für ${site(p)} installieren. Sobald du es bestellst, erscheint innerhalb einer Stunde das Schloss, und die Warnung ist weg.`,
    (p) => `Mit einem SSL-Zertifikat verschwindet die Warnung. Bestell eines für ${site(p)}, und wir installieren es für dich.`,
    (p) => `${site(p)} braucht ein SSL-Zertifikat für das Schloss. Wir richten es für dich ein, sobald du es bestellst.`,
  ],
  "tpl.ssh": [
    (p) => `Öffne einen SSH-Client wie PuTTYcat und verbinde dich als root mit ${p.hostname || "deinem Server"}. Das Passwort steht in der Setup-E-Mail, die wir von ${p.host} geschickt haben.`,
    (p) => `Du meldest dich per SSH an: Verbinde dich mit ${p.hostname || "deinem Server"} als Benutzer root und mit dem Passwort aus deiner Setup-E-Mail.`,
    (p) => `Nimm einen beliebigen SSH-Client und verbinde dich als root mit ${p.hostname || "deinem Server"}. Wenn du die Setup-E-Mail mit dem Passwort verloren hast, antworte hier, und wir schicken ein neues.`,
  ],
  "tpl.addon": [
    (p) => `Ja, es kann sich das Paket teilen. Füge die neue Domain im Kundenpanel unter panel.${p.host} bei Domains hinzu und wähle einen Ordner dafür.`,
    (p) => `Ein zweites Paket brauchst du nicht. Füge die Domain im Kundenpanel unter panel.${p.host} bei Domains hinzu und verweise sie auf einen eigenen Ordner.`,
    (p) => `Du kannst die neue Domain im selben Hosting betreiben. Öffne im Kundenpanel unter panel.${p.host} den Bereich Domains, füge sie hinzu und wähle einen Ordner.`,
  ],
  "tpl.php": [
    (p) => `Die PHP-Version für ${site(p)} wählst du selbst im Kundenpanel unter panel.${p.host} bei den PHP-Einstellungen. Sie gilt sofort.`,
    (p) => `Öffne die PHP-Einstellungen im Kundenpanel unter panel.${p.host} und wähle die neuere Version. ${site(p)} nutzt sie sofort.`,
    (p) => `Im Kundenpanel unter panel.${p.host} kannst du in den PHP-Einstellungen die Version für ${site(p)} wechseln. Wir empfehlen die neueste, die deine Plugins unterstützen.`,
  ],
  offerOnce: [
    (p) => `Wir können ${site(p)} für dich auf den neuesten Stand bringen. Das ist ein Einmalauftrag für ${euroCents(Number(p.once))}, und du musst nichts tun.`,
    (p) => `Der Software hinter ${site(p)} fehlen Sicherheitsupdates. Wir installieren sie für eine einmalige Gebühr von ${euroCents(Number(p.once))}.`,
    (p) => `Wir kümmern uns gern um das Update für ${site(p)}. Der Einmalpreis beträgt ${euroCents(Number(p.once))}.`,
  ],
  offerManaged: [
    (p) => `Wir können ${site(p)} ab jetzt dauerhaft für dich aktuell halten. Managed Updates kosten ${euroCents(Number(p.managed))} im Monat, und wir spielen jedes Sicherheitsupdate innerhalb eines Tages ein.`,
    (p) => `Mit Managed Updates für ${euroCents(Number(p.managed))} im Monat aktualisieren wir die Software hinter ${site(p)}, sobald ein Fix erscheint, damit du dich um nichts kümmern musst.`,
    (p) => `Wir bieten dir an, die Updates für ${site(p)} für ${euroCents(Number(p.managed))} im Monat zu übernehmen. Jedes Sicherheitsupdate wird innerhalb eines Tages eingespielt.`,
  ],
  free: [
    (p) => `Wir haben die Software hinter ${site(p)} kostenlos für dich aktualisiert. Alles läuft wieder auf dem neuesten Stand.`,
    (p) => `Dein Update für ${site(p)} ist erledigt, und du musst nichts bezahlen. Die Seite läuft auf der neuesten Version.`,
    (p) => `Wir haben das Update für ${site(p)} für dich übernommen. Diesmal ist es kostenlos, und die Seite ist auf dem neuesten Stand.`,
  ],
  clean: [
    (p) => `Wir haben ${site(p)} bereinigt und deine Startseite wiederhergestellt. Ändere bitte deine Passwörter und halte die Software aktuell.`,
    (p) => `${site(p)} ist wieder sauber und zeigt deine eigene Startseite. Wenn du die Software aktualisierst und neue Passwörter vergibst, bleibt das so.`,
    (p) => `Deine Seite ${site(p)} ist wieder in Ordnung. Wir haben die Dateien des Eindringlings entfernt; bitte aktualisiere die Software und wähle neue Passwörter.`,
  ],
  noBackup: [
    (p) => `Wir haben kein Backup von ${site(p)}, das wir einspielen könnten. Bitte lade die Seite aus deiner eigenen Kopie neu hoch und wähle neue Passwörter.`,
    (p) => `Leider gibt es bei uns kein Backup von ${site(p)}. Du musst die Seite aus deinen eigenen Dateien wiederherstellen und deine Passwörter ändern.`,
    (p) => `Wir können ${site(p)} nicht wiederherstellen, weil es kein Backup gibt. Bitte baue die Seite aus deiner eigenen Kopie neu auf und halte die Software aktuell.`,
  ],
  cleanPaid: [
    (p) => `Wir können ${site(p)} von Hand bereinigen und die Dateien des Eindringlings entfernen. Zu unserem Stundensatz kostet das ${euroCents(Number(p.cleanup))}.`,
    (p) => `Von ${site(p)} gibt es kein Backup, aber wir können die Seite für ${euroCents(Number(p.cleanup))} manuell bereinigen. Vergib danach bitte neue Passwörter.`,
    (p) => `Wir entfernen den Hack von ${site(p)} gern von Hand. Nach Stunden abgerechnet kostet die Bereinigung ${euroCents(Number(p.cleanup))}.`,
  ],
  "tpl.explain": [
    () => "Die zweite Zahlung deckt die Nutzung des letzten Monats ab, die wir nachträglich abrechnen. Du wurdest nicht doppelt belastet.",
    () => "Es gibt zwei Rechnungen, weil die Nutzung jeweils am Monatsende für den Vormonat abgerechnet wird. Beide stimmen, und nichts wurde doppelt abgebucht.",
    () => "Eine Zahlung gehört zur aktuellen Rechnung, die andere zur Nutzung des letzten Monats, die wir nachträglich abrechnen. Dein Konto ist in Ordnung.",
  ],
  "tpl.foundPayment": [
    () => "Wir haben deine Überweisung gefunden und der Rechnung zugeordnet. Du kannst die Mahnung ignorieren.",
    () => "Danke, deine Zahlung ist da und die Rechnung ist beglichen. Die Mahnung ging raus, bevor wir sie gebucht hatten.",
    () => "Deine Überweisung ist jetzt auf die Rechnung gebucht. Es ist nichts mehr offen, die Mahnung ist damit erledigt.",
  ],
  "tpl.resend": [
    () => "Wir haben dir eine Kopie der Rechnung geschickt. Sag uns bitte Bescheid, falls sie nicht ankommt.",
    () => "Eine Kopie der Rechnung ist unterwegs an deine Kontaktadresse.",
    () => "Klar. Wir haben dir die Rechnung noch einmal gemailt, sie sollte in ein paar Minuten in deinem Postfach sein.",
  ],
  "tpl.extension": [
    () => "Kein Problem, du kannst die Rechnung diesmal zwei Wochen später bezahlen. Deine Dienste bleiben online.",
    () => "Wir haben die Fälligkeit deiner Rechnung um zwei Wochen verschoben. Sonst ändert sich nichts.",
    () => "Das ist in Ordnung. Bitte zahle innerhalb von zwei Wochen nach dem üblichen Termin, deine Dienste laufen in der Zwischenzeit weiter.",
  ],
  "tpl.newPrice": [
    (p) => `Unsere Kosten sind dieses Jahr gestiegen, und der neue Preis für ${svc(p)} hilft uns, den Dienst schnell und zuverlässig zu halten.`,
    (p) => `Wir verstehen, dass die Erhöhung unwillkommen ist. Strom und Hardware wurden teurer, und der neue Preis hält ${svc(p)} auf dem Niveau, das du kennst.`,
    (p) => `Der neue Preis für ${svc(p)} spiegelt höhere Kosten für Strom und Hardware wider. Er bezahlt auch die Leute, die E-Mails wie diese beantworten.`,
  ],
  "tpl.awaitPayment": [
    () => "Danke. Deine Dienste sind wieder online, sobald die Zahlung eingegangen ist.",
    () => "Danke für die Info. Sobald die Zahlung bei uns eingeht, wird automatisch alles wieder eingeschaltet.",
    () => "Verstanden. Deine Dienste kommen zurück, sobald die Zahlung bei uns gebucht ist.",
  ],
  "tpl.offer": [
    (p) => `Wir können ${svc(p)} ohne Ausfallzeit mehr Ressourcen geben. Die Preise stehen in der angehängten Übersicht, antworte einfach, und wir stellen um.`,
    (p) => `Mehr Ressourcen sind kein Problem. Das Upgrade dauert ein paar Minuten, ${svc(p)} bleibt online, und die Preise findest du im Anhang.`,
    (p) => `Danke, dass du mit uns wächst. Wir haben die Preise für mehr Ressourcen angehängt und stellen ${svc(p)} noch am Tag deiner Antwort um.`,
  ],
  "tpl.warn": [
    (p) => `Von ${svc(p)} geht Abuse-Traffic aus, den andere Netze bei uns melden. Bitte behebe das innerhalb von 24 Stunden, sonst müssen wir den Dienst sperren.`,
    (p) => `Wir haben Abuse-Meldungen zu ${svc(p)} erhalten. Bitte sichere den Dienst innerhalb von 24 Stunden ab, um eine Sperrung zu vermeiden.`,
    (p) => `Andere Anbieter melden Angriffe oder Spam, die von ${svc(p)} ausgehen. Vermutlich wurde der Dienst kompromittiert. Bitte bereinige ihn innerhalb von 24 Stunden, sonst sperren wir ihn.`,
  ],
  credit: [
    (p) => `Entschuldige die Umstände. Wir haben deinem Konto ${euroCents(Number(p.credit))} gutgeschrieben, die von deiner nächsten Rechnung abgezogen werden.`,
    (p) => `Als Entschuldigung fällt deine nächste Rechnung um ${euroCents(Number(p.credit))} niedriger aus. Danke, dass du bei uns bleibst.`,
    (p) => `Wir haben deinem Konto ein Guthaben von ${euroCents(Number(p.credit))} hinzugefügt. Es wird automatisch von deiner nächsten Rechnung abgezogen.`,
  ],
  refund: [
    (p) => `Wir haben dir einen Monat, ${euroCents(Number(p.refund))}, auf dein Konto erstattet. Es tut uns leid, dass das passiert ist.`,
    (p) => `Du erhältst für diesen Monat eine Erstattung von ${euroCents(Number(p.refund))}. Bitte entschuldige die Umstände.`,
    (p) => `Wir haben dir einen vollen Monat erstattet: ${euroCents(Number(p.refund))}. Das Geld ist in wenigen Tagen auf deinem Konto.`,
  ],
  refuse: [
    () => "Wir haben deine Anfrage sorgfältig geprüft. Die Unterbrechung ist durch deine Vertragsbedingungen abgedeckt, deshalb können wir diesmal keine Erstattung anbieten.",
    () => "Danke für deine Nachricht. Dein Service-Level deckt diesen Fall ab, deshalb ist keine Erstattung möglich. Die Unannehmlichkeiten tun uns leid.",
    () => "Wir verstehen deinen Frust, können diesen Zeitraum aber nicht erstatten. Deine Vertragsbedingungen gelten hier.",
  ],
  revert: [
    (p) => `Wir haben den Preis von ${svc(p)} auf den Betrag zurückgesetzt, den du vorher gezahlt hast. Die Änderung gilt ab deiner nächsten Rechnung.`,
    (p) => `Gut, dass du nachfragst. ${svc(p)} kehrt mit der nächsten Rechnung zum bisherigen Preis zurück.`,
    (p) => `Wir haben die Preisänderung für ${svc(p)} rückgängig gemacht. Deine nächste Rechnung zeigt wieder den alten Preis.`,
  ],
  "retain.half": [
    () => "Es würde uns leidtun, dich zu verlieren. Wenn du bleibst, zahlst du für deinen nächsten Monat nur die Hälfte, und alles bleibt, wie es ist.",
    () => "Bevor du gehst, möchten wir dir 50 % auf deinen nächsten Monat geben. Antworte, wenn du bleiben möchtest.",
    () => "Wir schätzen dich als Kunden. Bleib bei uns, und wir halbieren deinen nächsten Monat.",
  ],
  "retain.free": [
    () => "Es würde uns leidtun, dich zu verlieren. Wenn du bleibst, geht dein nächster Monat auf uns, und alles bleibt, wie es ist.",
    () => "Bevor du gehst, möchten wir dir einen kostenlosen Monat als Entschädigung für den Ärger anbieten. Antworte, wenn du bleiben möchtest.",
    () => "Wir schätzen dich als Kunden. Bleib bei uns, und der nächste Monat kostet dich nichts.",
  ],
  "retain.discount": [
    (p) => `Es würde uns leidtun, dich zu verlieren. Wenn du bleibst, bekommst du ${p.months} ${plural(p.months, "Monat", "Monate")} lang 20 % Rabatt auf deine Dienste.`,
    (p) => `Bevor du gehst, möchten wir dir ${p.months} ${plural(p.months, "Monat", "Monate")} lang 20 % Rabatt anbieten. Antworte, wenn du bleiben möchtest.`,
    (p) => `Wir schätzen dich als Kunden. Bleib bei uns, und dein Preis sinkt ${p.months} ${plural(p.months, "Monat", "Monate")} lang um ein Fünftel.`,
  ],
  "retain.upgrade": [
    () => "Es würde uns leidtun, dich zu verlieren. Wenn du bleibst, stufen wir deinen Dienst um eine Größe hoch, zum heutigen Preis.",
    () => "Bevor du gehst, möchten wir dir ohne Aufpreis mehr Ressourcen geben. Antworte, wenn du bleiben möchtest.",
    () => "Wir schätzen dich als Kunden. Bleib bei uns, und wir erweitern deinen Dienst kostenlos.",
  ],
  "retain.fix": [
    (p) => `Entschuldige die Umstände. Wir beheben das innerhalb von ${p.fixDays} ${plural(p.fixDays, "Tag", "Tagen")} und melden uns dann bei dir. Bitte gib uns die Chance, es wiedergutzumachen.`,
    (p) => `Bitte entschuldige. Unser Team arbeitet daran, und in ${p.fixDays} ${plural(p.fixDays, "Tag", "Tagen")} läuft dein Dienst so, wie er soll.`,
    (p) => `Wir haben dich enttäuscht, und das tut uns leid. Gib uns ${p.fixDays} ${plural(p.fixDays, "Tag", "Tage")}, um das zu beheben, bevor du dich entscheidest.`,
  ],
  "retain.move": [
    () => "Entschuldige die Umstände. Wenn du bleibst, ziehen wir deinen Dienst auf einen besseren Server in unserem Rechenzentrum um und kümmern uns um den Umzug.",
    () => "Bevor du gehst, lass uns deinen Dienst auf einen besseren Server umziehen. Den Umzug legen wir auf einen Zeitpunkt, der dir passt.",
    () => "Wir schätzen dich als Kunden. Bleib bei uns, und wir ziehen deinen Dienst kostenlos auf einen neueren Server um.",
  ],
  cancel: [
    () => "Wir haben deine Kündigung bearbeitet. Deine Dienste enden heute, und du erhältst eine Schlussrechnung. Danke, dass du bei uns gehostet hast.",
    () => "Dein Vertrag ist wie gewünscht gekündigt. Lade bitte alles herunter, was du behalten möchtest, die Dienste enden heute.",
    () => "Wir bestätigen die Kündigung deiner Dienste. Danke für die Zeit mit uns, und viel Erfolg bei deinem neuen Hoster.",
  ],
  unsuspend: [
    (p) => `Deine Dienste sind wieder online. Du hast noch ${p.days} ${plural(p.days, "Tag", "Tage")} Zeit, die offene Rechnung zu bezahlen.`,
    (p) => `Wir haben alles wieder eingeschaltet und die Zahlungsfrist um ${p.days} ${plural(p.days, "Tag", "Tage")} verlängert.`,
    (p) => `Deine Dienste laufen wieder. Bitte begleiche die Rechnung in den nächsten ${p.days} ${plural(p.days, "Tag", "Tagen")}.`,
  ],
  keep: [
    () => "Wir verstehen die Lage, aber deine Dienste bleiben gesperrt, bis die offene Rechnung bezahlt ist. Danach gehen sie automatisch wieder online.",
    () => "Es tut uns leid, aber wir können die Sperre nicht vor Zahlungseingang aufheben. Sobald sie da ist, läuft sofort wieder alles.",
    () => "Deine Dienste bleiben vorerst gesperrt. Sobald die Rechnung bezahlt ist, werden sie ohne weitere Schritte wieder eingeschaltet.",
  ],
  forward: [
    (p) => `Vielen Dank für Ihre Meldung zu ${p.url}. Wir haben sie an unseren Kunden weitergeleitet und ihn um eine Antwort gebeten.`,
    (p) => `Wir haben Ihre Meldung zu ${p.url} an den Kunden weitergegeben, der für die Seite verantwortlich ist.`,
    (p) => `Ihre Meldung zu ${p.url} wurde an unseren Kunden weitergeleitet. Wenden Sie sich für alles Weitere bitte direkt an ihn.`,
  ],
  takedown: [
    (p) => `Vielen Dank für Ihre Meldung. Der Inhalt unter ${p.url} wurde für ${p.hours} ${plural(p.hours, "Stunde", "Stunden")} offline genommen, während unser Kunde ihn prüft.`,
    (p) => `Wir haben den Zugriff auf ${p.url} für ${p.hours} ${plural(p.hours, "Stunde", "Stunden")} gesperrt und unseren Kunden informiert.`,
    (p) => `Das Material unter ${p.url} ist ab sofort offline. Unser Kunde hat ${p.hours} ${plural(p.hours, "Stunde", "Stunden")} Zeit, auf Ihre Meldung zu antworten.`,
  ],
  notOurs: [
    (p) => `Vielen Dank für Ihre Meldung zu ${p.url}. Diese Seite liegt nicht in unserem Netz, deshalb können wir nicht tätig werden. Führen Sie "whois ${siteOf(p)}" aus, um den Registrar zu finden, und danach whois für die IP-Adresse, auf die die Domain zeigt: Das Ergebnis nennt den Hosting-Anbieter und dessen Abuse-Kontakt.`,
    (p) => `Wir haben ${p.url} geprüft, und die Seite wird nicht in unserem Netz gehostet. Eine whois-Abfrage zu ${siteOf(p)} zeigt den Registrar, eine whois-Abfrage zur IP-Adresse der Seite das Netz, das sie hostet, meist mit einer Abuse-Adresse, an die Sie schreiben können.`,
    (p) => `Die Seite unter ${p.url} gehört nicht zu uns. Um den richtigen Ansprechpartner zu finden, fragen Sie ${siteOf(p)} per whois für den Registrar ab und die zugehörige IP-Adresse per whois für die Abuse-Stelle des Hosting-Anbieters.`,
  ],
  reject: [
    (p) => `Wir haben Ihre Meldung zu ${p.url} geprüft. Sie erfüllt die formalen Anforderungen nicht, daher werden wir nicht tätig.`,
    (p) => `Vielen Dank für Ihre Nachricht zu ${p.url}. Nach Prüfung sehen wir keinen Grund, den Inhalt zu entfernen.`,
    (p) => `Wir haben Ihre Meldung zu ${p.url} geprüft und können in der vorliegenden Form nicht darauf reagieren.`,
  ],
  comply: [
    (p) => `Wir bestätigen den Eingang Ihrer Anfrage zu ${p.url}. Wir kommen ihr nach und liefern die verlangten Informationen innerhalb der genannten Frist.`,
    (p) => `Ihre Anfrage zu ${p.url} ist eingegangen. Wir werden kooperieren und Ihnen die gewünschten Informationen schicken.`,
    (p) => `Wir werden Ihrer Anfrage zu ${p.url} nachkommen. Unser Team stellt die verlangten Unterlagen zusammen.`,
  ],
  object: [
    (p) => `Wir haben Ihre Anfrage zu ${p.url} erhalten. In dieser Form widersprechen wir ihr und verlangen einen Gerichtsbeschluss, bevor wir Daten herausgeben oder Inhalte entfernen.`,
    (p) => `Zu ${p.url} können wir ohne Gerichtsbeschluss nicht tätig werden. Auf einen solchen reagieren wir selbstverständlich umgehend.`,
    (p) => `Wir lehnen Ihre Anfrage zu ${p.url} respektvoll ab. Die Daten unserer Kunden geben wir nur auf Grundlage eines Gerichtsbeschlusses heraus.`,
  ],
  "decline.notOffered": [
    (p) => `Danke für dein Interesse an ${hosting(p)}. Leider bieten wir dieses Produkt in ${p.city} derzeit nicht an, daher können wir deine Bestellung nicht annehmen.`,
    (p) => `Danke für deine Bestellung. Leider ist ${p.line} in ${p.city} noch nicht verfügbar. Wir hoffen, dir in Zukunft helfen zu können.`,
    (p) => `Schön, dass du an uns gedacht hast. ${p.line} gehört in ${p.city} derzeit nicht zu unserem Angebot, deshalb müssen wir diese Bestellung ablehnen.`,
  ],
  "decline.noCapacity": [
    (p) => `Danke für deine Bestellung von ${hosting(p)}. Unsere Server in ${p.city} sind derzeit voll ausgelastet, daher können wir sie nicht für dich einrichten.`,
    (p) => `Es tut uns leid, aber wir haben in ${p.city} gerade keine freie Kapazität und können deine Bestellung nicht annehmen. Wir hoffen, dich ein andermal begrüßen zu dürfen.`,
    (p) => `Danke, dass du dich für uns entschieden hast. Leider ist ${p.city} voll ausgelastet, und wir lehnen lieber ab, als ${p.line} schlecht einzurichten.`,
  ],
  "decline.busy": [
    (p) => `Danke für dein Interesse an ${hosting(p)}. Neue Bestellungen dieser Art nehmen wir derzeit nicht an.`,
    () => "Danke für deine Bestellung. Leider können wir sie zurzeit nicht übernehmen. Wir wünschen dir viel Erfolg mit deinem Projekt.",
    (p) => `Wir schätzen deine Anfrage für ${hosting(p)}, können sie aber gerade nicht annehmen.`,
  ],
  accept: [
    (p) => `Danke für deine Bestellung. ${hosting(p)} ist in ${p.city} eingerichtet und seit ${day(p)} online, für ${euroCents(Number(p.price))} im Monat. Deine Zugangsdaten folgen in einer separaten E-Mail.`,
    (p) => `Willkommen an Bord! Wir haben ${hosting(p)} am ${day(p)} in ${p.city} eingerichtet. Der Monatspreis beträgt ${euroCents(Number(p.price))}, und deine Zugangsdaten sind unterwegs.`,
    (p) => `Deine Bestellung ist abgeschlossen: ${hosting(p)} läuft seit ${day(p)} in ${p.city} für ${euroCents(Number(p.price))} im Monat. Die Zugangsdaten bekommst du in Kürze.`,
  ],
  failed: [
    (p) => `Danke für deine Bestellung. Wir haben versucht, ${hosting(p)} einzurichten, aber es ließ sich bei uns nicht abschließen. Das tut uns leid, und wir haben die Bestellung storniert.`,
    (p) => `Es tut uns leid: Die Einrichtung von ${hosting(p)} in ${p.city} ist fehlgeschlagen, deshalb müssen wir deine Bestellung stornieren. Es wurde nichts berechnet.`,
    (p) => `Leider konnten wir ${hosting(p)} nicht wie bestellt einrichten. Die Bestellung ist storniert, und es wird nichts in Rechnung gestellt.`,
  ],
  "order.quote": [
    (p) => `Danke für deine Anfrage zu ${hosting(p)}. Wir können es dir für ${euroCents(Number(p.price))} im Monat anbieten${setupFee(p)}. Sag uns Bescheid, ob das für dich passt.`,
    (p) => `Hier ist unser Angebot für ${hosting(p)} in ${p.city}: ${euroCents(Number(p.price))} im Monat${setupFee(p)}. Wir richten alles ein, sobald du bestätigst.`,
    (p) => `Danke, dass du dich gemeldet hast. Für ${hosting(p)} würden wir ${euroCents(Number(p.price))} im Monat berechnen${setupFee(p)}. Sag uns, ob du loslegen möchtest.`,
  ],
  "order.invoice": [
    (p) => `Wir bestätigen deine Bestellung von ${hosting(p)} für ${euroCents(Number(p.price))} im Monat. Die Rechnung ${p.invoice} über ${euroCents(Number(p.total))} hängt an. Wir richten alles ein, sobald sie bezahlt ist.`,
    (p) => `Deine Bestellung ist bestätigt: ${hosting(p)} in ${p.city} für ${euroCents(Number(p.price))} im Monat. Bitte bezahle die Rechnung ${p.invoice} (${euroCents(Number(p.total))}), dann legen wir los.`,
    (p) => `Danke, die Bestellung steht. ${hosting(p)} kostet ${euroCents(Number(p.price))} im Monat; die erste Rechnung, ${p.invoice}, beläuft sich auf ${euroCents(Number(p.total))}.`,
  ],
  "order.live": [
    (p) => (p.domain
      ? `${domainLine(p)} Es ist seit ${day(p)} auf unseren Servern in ${p.city} live. Melde dich unter panel.${p.host} mit dem Benutzernamen ${String(p.domain).split(".")[0]} an; das Passwort folgt in einer separaten E-Mail. Lade deine Seite per FTP nach ftp.${p.domain} hoch.`
      : `Dein ${p.line} in ${p.city} läuft seit ${day(p)}. Melde dich per SSH als root an; Adresse und Passwort folgen in einer separaten E-Mail.`),
    (p) => (p.domain
      ? `${domainLine(p)} Dein Webspace ist seit ${day(p)} bereit. Das Kundenpanel erreichst du unter panel.${p.host}, und deine Postfächer sind unter mail.${p.host} eingerichtet.`
      : `${p.line} ist seit ${day(p)} in ${p.city} online. Dein Root-Zugang ist per separater E-Mail unterwegs.`),
    (p) => `Alles ist eingerichtet: ${hosting(p)} läuft seit ${day(p)} in ${p.city}.${p.domain ? ` ${domainLine(p)}` : ""} Deine Zugangsdaten folgen in einer separaten E-Mail.`,
  ],
};
// The one email of a finished order: account, confirmation with its invoice, domain and setup.
const DONE: [Mail, Mail, Mail] = [
  (p) => `Wir bestätigen deine Bestellung von ${hosting(p)} für ${euroCents(Number(p.price))} im Monat. Dein Kundenkonto bei uns ist eingerichtet, und die Rechnung ${p.invoice} über ${euroCents(Number(p.total))} hängt an.`,
  (p) => `Deine Bestellung ist bestätigt, und dein Kundenkonto ist bereit. Bitte bezahle die Rechnung ${p.invoice} (${euroCents(Number(p.total))}) in den nächsten Tagen.`,
  (p) => `Danke, die Bestellung steht: ${hosting(p)} kostet ${euroCents(Number(p.price))} im Monat, und die erste Rechnung, ${p.invoice}, beträgt ${euroCents(Number(p.total))}. Dein Kundenkonto ist eingerichtet.`,
];
MAILS["order.done"] = [0, 1, 2].map((i): Mail => (p) => `${DONE[i](p)} ${MAILS["order.live"][i](p)}`) as [Mail, Mail, Mail];
const LEAD = ["decline.notOffered", "decline.noCapacity", "decline.busy", "accept", "failed", "order.quote", "order.invoice", "order.live", "order.done"];
const SENDER = ["forward", "takedown", "notOurs", "reject", "comply", "object"];

export default Object.fromEntries(Object.entries(MAILS).flatMap(([what, bodies]) =>
  bodies.map((body, i) => [`reply.${what}.${i}`, (LEAD.includes(what) ? lead : SENDER.includes(what) ? sender : customer)(i, body)]))) as Dict;
