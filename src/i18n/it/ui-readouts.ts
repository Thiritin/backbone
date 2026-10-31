import type { Dict } from "../lang";

export default {
  "readouts.start": () => "Inizio",
  "readouts.finish": () => "Fine",
  "readouts.task": () => "Attività",
  "readouts.status": () => "Stato",
  "readouts.noTasks": () => "Nessuna attività",
  "readouts.running": () => "In corso",
  "readouts.done": () => "Fatto",
  "readouts.error": () => "Errore",
  "readouts.tasks": () => "Registro attività",
  "readouts.task.install": (p) => `Installare ${p.software} su ${p.name}`,
  "readouts.task.update": (p) => `Aggiornare ${p.software}`,
  "readouts.task.php": () => "Ricompilazione di PHP",
  "readouts.task.move": (p) => `Spostare ${p.name}`,
  "readouts.task.clone": (p) => `Clonare ${p.name}`,
  "readouts.task.recover": (p) => `Recuperare ${p.name}`,
  "readouts.task.restore": (p) => `Ripristinare ${p.name}`,
  "readouts.task.created": (p) => `Account ${p.name} creato`,
  "readouts.task.backup": (p) => `Backup di ${p.name}`,
  "readouts.task.lostDisks": (p) => `${p.name} ha perso i suoi dischi`,
  "readouts.serverStatus": () => "Stato del server",
} satisfies Dict;
