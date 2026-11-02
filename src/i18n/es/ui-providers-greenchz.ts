import type { Dict } from "../lang";

export default {
  "providers.greenchz.navHome": () => "Inicio",
  "providers.greenchz.navSites": () => "Centros de datos",
  "providers.greenchz.navOrder": () => "Colocation",
  "providers.greenchz.navAccount": () => "Centro de clientes",
  "providers.greenchz.heroEarly": () => "Housing y colocation en Suiza",
  "providers.greenchz.heroLate": () => "Centros de datos suizos para datos que se quedan en Suiza.",
  "providers.greenchz.text": (p) => `Nuestro centro de datos cerca de ${p.city} guarda sus datos bajo la ley suiza, en una infraestructura certificada alimentada con energía renovable.`,
  "providers.greenchz.cta": () => "Pedir una oferta",
  "providers.greenchz.point1": () => "Calidad suiza",
  "providers.greenchz.point1Text": () => "Construimos y operamos cada sede nosotros mismos y mantenemos sus datos en el país.",
  "providers.greenchz.point2": () => "Seguridad certificada",
  "providers.greenchz.point2Text": () => "El control de acceso, la energía redundante y las auditorías siguen normas reconocidas.",
  "providers.greenchz.point3": () => "Energía renovable",
  "providers.greenchz.point3Text": () => "Nuestros centros de datos funcionan con electricidad hidráulica suiza.",
  "providers.greenchz.footer": (p) => `© ${p.year} green.chz AG`,
} satisfies Dict;
