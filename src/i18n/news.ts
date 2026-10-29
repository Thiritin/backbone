type Params = Record<string, string | number>;

// Headlines of the News app; spread into en. Heize online covers hardware and software, Golem.dy the internet, Handelsblah the market.
const kind = (p: Params) => (p.kind === "panel" ? "hosting panel" : p.kind === "game" ? "game server panel" : "cloud platform");

export const NEWS_EN: Record<string, (p: Params) => string> = {
  "event.news.software.title": (p) => `${p.name} released`,
  "event.news.software.text": (p) => `Heize online reports that the ${kind(p)} ${p.name} is out and can be installed on your servers.`,
  "event.news.generation.title": (p) => `G${p.gen} servers in the shop`,
  "event.news.generation.text": (p) => `Heize online reports that the G${p.gen} generation brings ${p.cores} cores and ${p.ramGb} GB of RAM per standard server, with ${p.disk} storage.`,
  "event.news.endOfSale.title": (p) => `${p.name} off the market`,
  "event.news.endOfSale.text": (p) => `Heize online reports that the ${p.name} has left the shop, and support for the model ends in ${p.supportEnd}.`,
  "event.news.mail.title": (p) => `${p.name} opens for business mail`,
  "event.news.mail.text": (p) => `Handelsblah reports that ${p.name} now sells hosted mailboxes to companies at ${p.price} euro a seat each month.`,
  "event.news.ipv6Dc.title": () => "IPv6 at datacenters",
  "event.news.ipv6Dc.text": () => "Golem.dy reports that datacenters now hand out IPv6 addresses, which nobody has been out of yet.",
  "event.news.ipv6Home.title": () => "IPv6 on home lines",
  "event.news.ipv6Home.text": () => "Golem.dy reports that home lines now carry IPv6, so the nightly reconnect has one more address to change.",
  "event.news.ripeLast.title": () => "RIPE hands out its last /8",
  "event.news.ripeLast.text": () => "Golem.dy reports that RIPE is down to its last /8, and new members now receive a /22 instead of a /21.",
  "event.news.ripeOut.title": () => "IPv4 pool exhausted",
  "event.news.ripeOut.text": () => "Golem.dy reports that RIPE has no free IPv4 addresses left, and new members join a waiting list for a /24.",
  "event.news.gpu.title": (p) => `${p.name} launched`,
  "event.news.gpu.text": (p) => `Heize online reports that the ${p.name} is out for ${p.price} euro list price, and draws ${p.watts} watts for it.`,
  "event.news.gpuDemand.title": (p) => (p.year === 2017 ? "Deep learning needs GPUs" : "Generative AI needs GPUs"),
  "event.news.gpuDemand.text": (p) => (p.year === 2017
    ? "Handelsblah reports that deep learning has teams looking for rented GPU servers, and agencies and developers now ask hosters for them."
    : "Handelsblah reports that generative AI has companies queuing for rented GPU servers, and hosters with free cards can name their price."),
  "event.news.design.title": (p) => `Web design of ${p.year}`,
  "event.news.design.text": (p) => `Handelsblah reports that visitors now expect the ${p.year} look from every website, and older designs lose requests.`,
  "event.news.line.title": (p) => `${p.line} could sell`,
  "event.news.line.text": (p) => `Handelsblah reports that you can deliver ${p.line} today and have not listed it on your website.`,
};
