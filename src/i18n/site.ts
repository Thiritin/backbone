type Params = Record<string, string | number>;

// The company site's hosting and design, and the blurbs on customer sites; spread into en.
export const SITE_EN: Record<string, (p: Params) => string> = {
  "ledger.siteHosting": () => "Website hosting: Strateaux",
  "ledger.redesign": () => "Website redesign",
  "error.designCurrent": () => "The website already has the current design.",
  "error.siteHostPanel": () => "Only a web hosting panel host can run the website.",
  "error.siteHostNoRoom": () => "This host has no room for the website.",
  "event.siteDown.title": () => "Website is down",
  "event.siteDown.text": (p) => `Your website on ${p.host} no longer answers, and visitors cannot order until it is back.`,
  "site.blurb.private": () => "Holiday photos, a guestbook and a visitor counter that has not moved in years.",
  "site.blurb.gamer": () => "The clan page with a member list, match results and the address of the game server.",
  "site.blurb.hobbyDev": () => "A portfolio of side projects, most of them described as almost finished.",
  "site.blurb.soleProp": () => "Services, opening hours and a contact form for a one-person business.",
  "site.blurb.smallBiz": () => "A price list, a map and the opening hours of the shop around the corner.",
  "site.blurb.agency": () => "Case studies, a wall of client logos and a button that says Let's talk.",
  "site.blurb.office": () => "Consulting hours, appointment requests and a privacy notice.",
  "site.blurb.onlineShop": () => "A product catalogue with a shopping cart and a checkout.",
  "site.blurb.enterprise": () => "Press releases, an investor page and a careers section with a stock photo of a handshake.",
};
