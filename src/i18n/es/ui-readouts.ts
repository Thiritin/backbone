import type { Dict } from "../lang";

export default {
  "readouts.start": () => "Inicio",
  "readouts.finish": () => "Fin",
  "readouts.task": () => "Tarea",
  "readouts.status": () => "Estado",
  "readouts.noTasks": () => "Sin tareas",
  "readouts.running": () => "En curso",
  "readouts.done": () => "Hecho",
  "readouts.error": () => "Error",
  "readouts.tasks": () => "Registro de tareas",
  "readouts.task.install": (p) => `Instalar ${p.software} en ${p.name}`,
  "readouts.task.update": (p) => `Actualizar ${p.software}`,
  "readouts.task.php": () => "Recompilación de PHP",
  "readouts.task.move": (p) => `Mover ${p.name}`,
  "readouts.task.clone": (p) => `Clonar ${p.name}`,
  "readouts.task.recover": (p) => `Recuperar ${p.name}`,
  "readouts.task.restore": (p) => `Restaurar ${p.name}`,
  "readouts.task.created": (p) => `Cuenta ${p.name} creada`,
  "readouts.task.backup": (p) => `Copia de seguridad de ${p.name}`,
  "readouts.task.lostDisks": (p) => `${p.name} perdió sus discos`,
  "readouts.serverStatus": () => "Estado del servidor",
} satisfies Dict;
