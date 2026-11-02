import type { Dict } from "./lang";

// SkyBlink's site copy.

export default {
  "providers.skyblink.navSites": () => "Data center",
  "providers.skyblink.navOrder": () => "Colocation",
  "providers.skyblink.navPortal": () => "MySkyBlink",
  "providers.skyblink.claim": () => "Your servers in the clouds of South Limburg",
  "providers.skyblink.side": (p) => `Data center ${p.city}`,
  "providers.skyblink.more": () => "View the data center",
  "providers.skyblink.heroEarly": () => "Colocation with your head in the clouds and your feet on the ground",
  "providers.skyblink.heroLate": () => "A data center on the border of three countries",
  "providers.skyblink.text": (p) => `${p.name} in ${p.city} houses your servers close to Aachen, Liège and Maastricht. Rack space starts at ${p.price} a month.`,
  "providers.skyblink.usp1": () => "Carrier-neutral",
  "providers.skyblink.usp1Text": (p) => `Choose from ${p.carriers} carriers in the building.`,
  "providers.skyblink.usp2": () => "Engineers on site",
  "providers.skyblink.usp2Text": (p) => `Remote hands answer within ${p.hours} hours.`,
  "providers.skyblink.usp3": () => "Short lines",
  "providers.skyblink.usp3Text": () => "You talk directly to the people who run the building.",
  "providers.skyblink.from": (p) => `Rack space from ${p.price} a month.`,
  "providers.skyblink.quote": () => "Request a quote",
  "providers.skyblink.footer": (p) => `© ${p.year} SkyBlink B.V.`,
} satisfies Dict;
