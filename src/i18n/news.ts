type Params = Record<string, string | number>;

// Headlines of the News app; spread into en. Heize online covers hardware and software, Golem.dy the internet, Handelsblah the market.
// Names joined by "|" read as "A, B and C".
const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`; };
const FEATURE: Record<string, string> = {
  cluster: "runs as one cluster across several servers",
  balloon: "balloons guest RAM, so a virtual machine grows its RAM while it runs",
  importSame: "imports web spaces from another server running it",
  importOther: "imports web spaces from other hosting panels",
};
const kind = (p: Params) => (p.kind === "panel" ? "hosting panel" : p.kind === "game" ? "game server panel" : "cloud platform");

export const NEWS_EN: Record<string, (p: Params) => string> = {
  "event.news.software.title": (p) => `${p.name} released`,
  "event.news.software.text": (p) => `Heize online reports that the ${kind(p)} ${p.name} is out and can be installed on your servers.`,
  "event.news.autoUpdate.title": (p) => `${p.name} updates itself`,
  "event.news.autoUpdate.text": (p) => `Heize online reports that ${p.name} can now install its updates automatically at night.`,
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
  "event.news.rivalOutage.title": (p) => `${p.name}: ${p.city} down for ${p.hours} hours`,
  "event.news.rivalOutage.text": (p) => `Golem.dy reports that customers of ${p.name} in ${p.city} could not reach their sites for ${p.hours} hours.`,
  "event.news.line.title": (p) => `${p.line} could sell`,
  "event.news.line.text": (p) => `Handelsblah reports that you can deliver ${p.line} today and have not listed it on your website.`,
  "event.news.models.title": () => "New hardware in the shop",
  "event.news.models.text": (p) => `Heize online reports that the shop now sells the ${list(p.names)}.`,
  "event.news.shape.title": (p) => `${p.name} servers in the shop`,
  "event.news.shape.text": (p) => `Heize online reports that the shop now sells ${p.name} servers.`,
  "event.news.feature.title": (p) => `${p.name} update`,
  "event.news.feature.text": (p) => `Heize online reports that the new release of ${p.name} ${FEATURE[p.feature] ?? p.feature}.`,
  "event.news.desk.title": (p) => `${p.name} released`,
  "event.news.desk.text": (p) => `Heize online reports that the help desk ${p.name} is out and can be subscribed to in the Pear Store.`,
  "event.news.training.title": (p) => `${p.name} training offered`,
  "event.news.training.text": (p) => `Heize online reports that a training in ${p.name} is now offered, and your team can take it in Research.`,
  "event.news.release.title": (p) => `Software releases of ${p.year}`,
  "event.news.release.text": (p) => `Heize online reports that the ${p.year} releases of ${list(p.names)} are out and can be installed on your servers.`,
  "event.news.homeLines.title": () => "New home lines",
  "event.news.homeLines.text": (p) => `Golem.dy reports that ${list(p.names)} can now be ordered for your home.`,
  "event.news.ports.title": (p) => `${p.gbit} Gbit/s ports`,
  "event.news.ports.text": (p) => `Golem.dy reports that carriers and internet exchanges now sell ${p.gbit} Gbit/s ports.`,
  "event.news.freeSsl.title": () => "Free SSL certificates",
  "event.news.freeSsl.text": () => "Handelsblah reports that Let's Encryptly now issues SSL certificates for free, and customers no longer expect to pay for one.",
};
