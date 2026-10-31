import type { Dict } from "../lang";

export default {
  "error.packageProduct": () => "Esta instalación no vende ese producto.",
  "error.packageName": () => "Los nombres de paquete usan hasta 24 letras, dígitos, espacios, guiones y guiones bajos.",
  "error.packageTaken": () => "Ya existe un paquete con este nombre.",
  "error.packageSpec": () => "Indica un tamaño de CPU, RAM y disco mayor que cero.",
  "error.packageLimit": () => "Una instalación guarda como máximo 12 paquetes.",
  "error.packageInUse": () => "Hay cuentas activas que aún usan este paquete.",
  "error.packageMissing": () => "Este paquete no existe en el host elegido.",
  "error.packageTooSmall": () => "El paquete es demasiado pequeño para el plan pedido.",
  "error.username": () => "Los nombres de usuario empiezan con una letra y usan minúsculas y dígitos.",
  "error.usernameTaken": () => "Este nombre de usuario ya está en uso.",
} satisfies Dict;
