import type { Dict } from "./lang";

// myLoch's site copy.

export default {
  "providers.myloch.navHome": () => "Home",
  "providers.myloch.navSites": () => "Data center",
  "providers.myloch.navOrder": () => "Colocation",
  "providers.myloch.navPortal": () => "Customer Center",
  "providers.myloch.claim": () => "Hosting from Düsseldorf",
  "providers.myloch.heroEarly": () => "Colocation at fair prices",
  "providers.myloch.heroLate": () => "Your servers in our data center in Düsseldorf",
  "providers.myloch.text": (p) => `Put your own hardware in ${p.name} in ${p.city}, with power, network and support included.`,
  "providers.myloch.from": (p) => `From ${p.price} a month`,
  "providers.myloch.units": (p) => `${p.n} rack units`,
  "providers.myloch.power": (p) => `${p.kw} kW power`,
  "providers.myloch.hands": (p) => `Remote hands within ${p.hours} hours`,
  "providers.myloch.perMonth": (p) => `${p.price} / month`,
  "providers.myloch.order": () => "Order now",
  "providers.myloch.vat": () => "All prices are monthly and exclude VAT.",
  "providers.myloch.footer": (p) => `© ${p.year} myLoch managed IT AG`,
} satisfies Dict;
