import type { Dict } from "../lang";

export default {
  "readouts.start": () => "Start",
  "readouts.finish": () => "Ende",
  "readouts.task": () => "Aufgabe",
  "readouts.status": () => "Status",
  "readouts.noTasks": () => "Keine Aufgaben",
  "readouts.running": () => "Läuft",
  "readouts.done": () => "Fertig",
  "readouts.error": () => "Fehler",
  "readouts.tasks": () => "Aufgabenprotokoll",
  "readouts.task.install": (p) => `${p.software} auf ${p.name} installieren`,
  "readouts.task.update": (p) => `${p.software} aktualisieren`,
  "readouts.task.php": () => "PHP neu bauen",
  "readouts.task.move": (p) => `${p.name} verschieben`,
  "readouts.task.clone": (p) => `${p.name} klonen`,
  "readouts.task.recover": (p) => `${p.name} wiederherstellen`,
  "readouts.task.restore": (p) => `${p.name} aus Sicherung zurückholen`,
  "readouts.task.created": (p) => `Konto ${p.name} angelegt`,
  "readouts.task.backup": (p) => `Sicherung von ${p.name}`,
  "readouts.task.lostDisks": (p) => `${p.name} hat seine Platten verloren`,
  "readouts.serverStatus": () => "Serverstatus",
} satisfies Dict;
