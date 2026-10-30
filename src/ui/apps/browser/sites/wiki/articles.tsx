import type { ReactNode } from "react";
import { displayHost, WIKI_HOST } from "../../../../../sim/80-business/browser";
import { licensingAt, serverOsById, type LicenseEra } from "../../../../../sim/10-catalog/server-os";
import { SOFTWARE, type Software } from "../../../../../sim/10-catalog/platforms";
import { BASEMENT, MOMS_DSL, RACK_MODELS } from "../../../../../sim/20-world/datacenters";
import { COMPONENTS } from "../../../../../sim/10-catalog/hardware";
import { RECONNECT_HOUR, REP, STATIC_LINE_ADDRESSES, DELIST_HOURS, providerV4 } from "../../../../../sim/10-catalog/addresses";
import { REGISTRIES } from "../../../../../sim/30-customers/registry";
import { euroPrice } from "../../../../../sim/00-core/money";

export type Go = (url: string) => void;
export const CATEGORIES = ["Help", "Hardware", "Networking", "Software", "Business"] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Article { slug: string; title: string; category: Category; body: (go: Go, year: number) => ReactNode }

export const wikiUrl = (slug: string) => `www.${WIKI_HOST}/wiki/${slug}`;
export const articleBySlug = (slug: string): Article | undefined => ARTICLES.find((a) => a.slug.toLowerCase() === slug.toLowerCase());

export const A = ({ to, go, children, className }: { to: string; go: Go; children: ReactNode; className?: string }) => (
  <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);
// Links to pages that do not exist yet show red, like on any wiki.
export const W = ({ slug, go, children }: { slug: string; go: Go; children: ReactNode }) =>
  <A to={wikiUrl(slug)} go={go} className={slug.startsWith("Category:") || articleBySlug(slug) ? undefined : "new"}>{children}</A>;

const Infobox = ({ title, rows }: { title: string; rows: [string, ReactNode][] }) => (
  <table className="wk-info"><caption>{title}</caption><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
);

const os = serverOsById("lunix");
const osUrl = `${displayHost(os.site.host)}/`;
const reconnect = `${String(RECONNECT_HOUR).padStart(2, "0")}:00`;
const hdd = COMPONENTS.hdd, psu = COMPONENTS.psu;
const pct = (v: number) => `${Math.round(v * 1000) / 10} %`;

const licence = ({ kind, fee }: LicenseEra): string =>
  kind === "free" ? "Free" :
  kind === "once" ? `${euroPrice(fee)} once per server` :
  `${euroPrice(fee)} a month per ${kind === "account" ? "web space" : kind}`;

// Software of a kind that exists by the given year, with a link to its website.
function SoftwareTable({ kind, year, go }: { kind: Software["kind"]; year: number; go: Go }) {
  const rows = SOFTWARE.filter((x) => x.kind === kind && x.from <= year);
  return (
    <table className="wk-table">
      <thead><tr><th>Name</th><th>Released</th><th>Licence</th><th>Website</th></tr></thead>
      <tbody>{rows.map((x) => (
        <tr key={x.id}>
          <td>{x.name}</td><td>{x.from}</td><td>{licence(licensingAt(x, year))}</td>
          <td><A to={`${displayHost(x.site.host)}/`} go={go}>{displayHost(x.site.host)}</A></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export const ARTICLES: Article[] = [
  {
    slug: "Help:Starting_a_hosting_company",
    title: "Help:Starting a hosting company",
    category: "Help",
    body: (go) => <>
      <p>This page walks through the first weeks of a small hosting company, from an empty basement to the first paying customer. Each step links to the article that explains it in depth.</p>
      <h2>1. A server and a rack</h2>
      <p>A basement or spare room holds one small <W slug="Rack_unit" go={go}>rack</W>. Rack servers are bought from a hardware vendor and mounted into free units. Every <W slug="Power_supply" go={go}>power supply</W> has to be plugged in, and servers with several disks should be set up with <W slug="RAID" go={go}>RAID</W> so that one broken disk loses no data.</p>
      <h2>2. An internet line</h2>
      <p>The server reaches the internet through the router and the <W slug="Uplink" go={go}>uplink</W>, usually a <W slug="Digital_subscriber_line" go={go}>DSL</W> line at first. Its <W slug="IP_address" go={go}>IP address</W> is how visitors find the server.</p>
      <h2>3. Software</h2>
      <p>The server needs an <W slug="Operating_system" go={go}>operating system</W>, see <W slug="Server_installation" go={go}>server installation</W>. On top of it goes either a <W slug="Web_hosting_control_panel" go={go}>web hosting control panel</W> to sell web space, or a <W slug="Hypervisor" go={go}>hypervisor</W> to sell virtual servers.</p>
      <h2>4. A name and a shop window</h2>
      <p>A <W slug="Domain_name" go={go}>domain name</W> gives the company an address customers remember. The company website then lists the first products, usually <W slug="Web_hosting" go={go}>web hosting</W>.</p>
      <h2>5. Email</h2>
      <p>Customers write by email, so the company needs a mail service. Mail sent from a home line often ends up on an <W slug="Email_blacklist" go={go}>email blacklist</W>, which is why most small hosts start with a hosted provider.</p>
    </>,
  },
  {
    slug: "Server_installation",
    title: "Server installation",
    category: "Hardware",
    body: (go) => <>
      <p><b>Server installation</b> is the process of bringing a new server from its box to a running <W slug="Operating_system" go={go}>operating system</W>. A bare server ships with empty disks, so it cannot do anything until an operating system has been installed from removable media such as a USB stick.</p>
      <h2>Mounting and power</h2>
      <p>The server is first mounted in a <W slug="Rack_unit" go={go}>rack</W>. Each <W slug="Power_supply" go={go}>power supply</W> on the back then has to be plugged into a socket or a power strip. A server with redundant power supplies keeps running when one of them loses power, as long as the other one is still plugged in.</p>
      <h2>Network</h2>
      <p>To reach the internet the server needs an <W slug="Uplink" go={go}>uplink</W>. In a home or small office this is a network cable from one of the server's ports to the router, which in turn connects to the internet line, usually <W slug="Digital_subscriber_line" go={go}>DSL</W>. Without that cable the server is offline even when it is powered on.</p>
      <h2>Preparing the USB stick</h2>
      <p>The installer is downloaded as an ISO image from the website of the operating system, for example from <A to={osUrl} go={go}>{displayHost(os.site.host)}</A> for {os.name}. The download needs a working internet line, and its speed depends on the line's download rate. The ISO image is then written to a USB stick. Writing a new image replaces whatever was on the stick before.</p>
      <h2>Booting from the stick</h2>
      <ol>
        <li>Plug the USB stick into the USB port of the server. On most rack servers this port is on the front.</li>
        <li>Plug a monitor into the server to see its screen.</li>
        <li>Power the server on. While the start screen (POST) is shown, press <kbd>F11</kbd> to open the <b>boot menu</b>.</li>
        <li>Choose the USB stick in the boot menu. The server then starts the installer from the stick instead of its own disks.</li>
      </ol>
      <h2>Installing</h2>
      <p>The installer asks for a language and a hostname, then partitions the disks. Partitioning erases everything on them. Once the files are copied the server restarts from its disks, and the USB stick can be pulled and reused for the next server.</p>
      <h2>Logging in</h2>
      <p>After the restart the server shows a login prompt. On {os.name} the default user name is <code>root</code>.</p>
      <p>After the operating system runs, further software such as a <W slug="Hypervisor" go={go}>hypervisor</W> or a <W slug="Web_hosting_control_panel" go={go}>web hosting panel</W> is installed with the commands given on that software's website.</p>
    </>,
  },
  {
    slug: "Rack_unit",
    title: "Rack unit",
    category: "Hardware",
    body: (go) => <>
      <Infobox title="Rack unit" rows={[["Symbol", "U"], ["Height", "44.45 mm (1.75 in)"], ["Rack width", "19 in"]]} />
      <p>A <b>rack unit</b> (<b>U</b>) is the unit of height in a 19-inch server rack. Every device made for a rack is a whole number of units tall: a slim server or a switch takes 1U, larger servers with more disks take 2U or 4U.</p>
      <h2>Rack sizes</h2>
      <p>Racks are sold by their height in units. Common sizes are {RACK_MODELS.map((r) => `${r.units}U`).join(", ")}. A small {BASEMENT.maxUnits}U rack fits under a desk or in a basement, while datacenters use full-height racks of 42U and more.</p>
      <h2>Planning space</h2>
      <p>A device occupies as many consecutive units as it is tall, starting from the slot it is mounted in. Space runs out faster than expected, because switches, power strips and patch panels need units too. Power is the other limit of a rack: a rack full of servers can draw more than its circuit allows, see <W slug="Power_supply" go={go}>power supply</W>.</p>
      <h2>Renting space</h2>
      <p>Datacenters rent out whole racks, or shares of one such as a quarter or half rack, for companies that do not need a full rack yet. Placing one's own servers in someone else's datacenter is called <W slug="Colocation" go={go}>colocation</W>.</p>
    </>,
  },
  {
    slug: "Power_supply",
    title: "Power supply",
    category: "Hardware",
    body: (go) => <>
      <Infobox title="Server power supply" rows={[["Abbreviation", "PSU"], ["Typical life", `${psu.life} years`], ["Hot-swappable", "When redundant"]]} />
      <p>A <b>power supply unit</b> (<b>PSU</b>) turns mains power into the low voltages a server runs on. Entry-level servers have a single power supply, while most rack servers have two.</p>
      <h2>Redundancy</h2>
      <p>A server with two power supplies keeps running as long as one of them is plugged in and working. With only one, a pulled cord or a failed unit switches the whole server off at once. A failed power supply in a redundant server can be swapped while the server runs, as long as the other one carries the load.</p>
      <h2>Failure</h2>
      <p>Power supplies wear out like any other part. Within their expected life of about {psu.life} years roughly {pct(psu.before)} fail each year, and old units fail far more often, around {pct(psu.after)} a year.</p>
      <h2>Circuits and breakers</h2>
      <p>Every rack is fed by a circuit with a fixed limit, for example {BASEMENT.kw} kW for a home basement. When the servers in a rack draw more than that, the breaker trips and every server in the rack loses power until the load is reduced. Servers that lose power without a clean shutdown risk corrupted data unless their disks are protected by <W slug="RAID" go={go}>RAID</W>.</p>
      <h2>Power strips</h2>
      <p>A switched power strip, also called a power distribution unit or PDU, lets an administrator switch single outlets on and off remotely. A rack has room for one.</p>
    </>,
  },
  {
    slug: "RAID",
    title: "RAID",
    category: "Hardware",
    body: (go) => <>
      <Infobox title="RAID" rows={[["Full name", "Redundant array of independent disks"], ["Introduced", "1987"]]} />
      <p><b>RAID</b> combines several disks of a server into one array, so that the failure of a single disk loses no data. It is configured before the <W slug="Operating_system" go={go}>operating system</W> is installed, and changing the level later erases the array.</p>
      <h2>Levels</h2>
      <table className="wk-table">
        <thead><tr><th>Level</th><th>Minimum disks</th><th>Disks that may fail</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>None</td><td>1</td><td>0</td><td>Every disk failure loses data.</td></tr>
          <tr><td>RAID 1</td><td>2</td><td>1</td><td>Every disk holds a full copy. Half the space is usable with two disks.</td></tr>
          <tr><td>RAID 5</td><td>3</td><td>1</td><td>Parity spread over all disks. One disk worth of space goes to parity.</td></tr>
          <tr><td>RAID 6</td><td>4</td><td>2</td><td>Double parity. Two disks worth of space go to parity.</td></tr>
          <tr><td>RAID 10</td><td>4, even</td><td>1 per mirror pair</td><td>Mirrored pairs that are striped together. Half the space is usable.</td></tr>
        </tbody>
      </table>
      <h2>Disk failure and rebuild</h2>
      <p>Hard disks fail more often than any other part. About {pct(hdd.before)} of disks fail each year during their first {hdd.life} years, and around {pct(hdd.after)} after that. When a disk in an array fails, the server keeps running on the remaining disks. Once the broken disk has been replaced, the array <b>rebuilds</b> onto the new one, which takes hours on large disks. Until the rebuild finishes, the new disk does not count, so a second failure during that time can still destroy the array.</p>
      <h2>RAID is not a backup</h2>
      <p>RAID protects against broken disks. It does not protect against deleted files, a hacked server or an array that loses more disks than it can tolerate. Hosting companies keep separate backups for that.</p>
    </>,
  },
  {
    slug: "Uplink",
    title: "Uplink",
    category: "Networking",
    body: (go) => <>
      <p>An <b>uplink</b> is the connection that carries a network's traffic toward a larger network, and in the end toward the internet.</p>
      <p>In a home network the router is the uplink for every device cabled to it. The router itself is connected to the internet line, so a server that is cabled to the router reaches the internet through that line. The speed of the line, especially its upload rate, limits how much traffic the servers behind it can send to visitors.</p>
      <p>In a datacenter the servers are cabled to a switch, and the datacenter connects its racks to one or more transit providers. These connections are much faster than a home line and come with fixed addresses.</p>
      <h2>See also</h2>
      <ul>
        <li><W slug="Digital_subscriber_line" go={go}>Digital subscriber line</W></li>
        <li><W slug="IP_address" go={go}>IP address</W></li>
        <li><W slug="Server_installation" go={go}>Server installation</W></li>
      </ul>
    </>,
  },
  {
    slug: "Digital_subscriber_line",
    title: "Digital subscriber line",
    category: "Networking",
    body: (go) => <>
      <p><b>Digital subscriber line</b> (<b>DSL</b>) is a technology that carries internet access over an ordinary telephone line. It is the most common way households connect to the internet.</p>
      <h2>Speeds</h2>
      <p>Home DSL is asymmetric: the download rate is much higher than the upload rate. A typical private line such as DSL 6000 offers {MOMS_DSL.down} Mbit/s down and only about {MOMS_DSL.up} Mbit/s up. For people who serve websites from home the upload rate matters most, because every page a visitor loads is sent upstream.</p>
      <h2>Dynamic addresses</h2>
      <p>A private line gets a single <b>dynamic</b> <W slug="IP_address" go={go}>IP address</W>. The provider disconnects the line once a day, usually at night around {reconnect}, and assigns a new address on reconnect. Mail servers widely block addresses from dynamic ranges, see <W slug="Email_blacklist" go={go}>email blacklist</W>, and services that customers reach by address stop working whenever it changes. For that reason a dynamic line is usually only good for web hosting, with the domain kept pointing at the current address.</p>
      <p>Business lines cost more but come with {STATIC_LINE_ADDRESSES} <b>static</b> addresses that never change and no daily disconnect.</p>
      <h2>Getting a line</h2>
      <p>Ordering a new line takes from one to several weeks until a technician has connected it. Many small hosting companies therefore start on the family's existing private line and switch to a business line once they have paying customers.</p>
      <h2>See also</h2>
      <ul><li><W slug="Uplink" go={go}>Uplink</W></li></ul>
    </>,
  },
  {
    slug: "IP_address",
    title: "IP address",
    category: "Networking",
    body: (go, year) => <>
      <Infobox title="IPv4 address" rows={[["Length", "32 bits"], ["Example", "203.0.113.7"], ["Introduced", "1981"]]} />
      <p>An <b>IP address</b> is the number by which a machine is reached on the internet. Visitors seldom type it, because a <W slug="Domain_name" go={go}>domain name</W> stands in for it, but every server, router and virtual machine that offers a service needs one.</p>
      <h2>Static and dynamic</h2>
      <p>A <b>static</b> address stays the same. A <b>dynamic</b> address is handed out anew from time to time, on home <W slug="Digital_subscriber_line" go={go}>DSL</W> every night. Game servers, mail servers and anything customers reach by its number need a static address. Many web hosting customers can share one address, because the web server tells their sites apart by name.</p>
      <h2>Scarcity</h2>
      <p>The older IPv4 has only about four billion addresses, and the regional registries are running out of them. As the free pools shrink, providers charge more for each address, currently about {euroPrice(providerV4(year, 1))} a month. Large hosts become members of a registry themselves to get whole blocks of addresses at once.</p>
      <p>The newer IPv6 has more addresses than will ever be needed, and they cost next to nothing. Support for it spreads only slowly, so every public service still needs an IPv4 address alongside.</p>
    </>,
  },
  {
    slug: "Domain_name",
    title: "Domain name",
    category: "Networking",
    body: (go) => <>
      <p>A <b>domain name</b> such as <i>example.com</i> is the name under which a website or mail service is found on the internet. The name stands in for an <W slug="IP_address" go={go}>IP address</W>, which is hard to remember and may change.</p>
      <h2>Registries and registrars</h2>
      <p>Every top-level domain such as .com or .de is run by one <b>registry</b>. Customers do not buy from the registry directly but through a <b>registrar</b>, which passes the yearly fee on and adds its own margin. Hosting companies sign up with a registrar to buy domains for themselves and to resell them to their customers.</p>
      <table className="wk-table">
        <thead><tr><th>Ending</th><th>Registry</th></tr></thead>
        <tbody>{Object.entries(REGISTRIES).map(([tld, r]) => <tr key={tld}><td>.{tld}</td><td>{r.name}</td></tr>)}</tbody>
      </table>
      <h2>Choosing a name</h2>
      <p>A domain name has 3 to 40 characters made of letters, digits and hyphens. Each name exists only once per ending, so short and common names are usually taken. A domain is rented for a year at a time and has to be renewed, or it becomes free for anyone else.</p>
    </>,
  },
  {
    slug: "Operating_system",
    title: "Operating system",
    category: "Software",
    body: (go) => <>
      <p>An <b>operating system</b> is the software that runs a computer's hardware and the programs on it. Servers mostly run a free Unix-like system such as <A to={osUrl} go={go}>{os.name}</A>, or a commercial one when customers need its software.</p>
      <p>A new server has no operating system. It is installed from a USB stick, see <W slug="Server_installation" go={go}>server installation</W>.</p>
    </>,
  },
  {
    slug: "Web_hosting_control_panel",
    title: "Web hosting control panel",
    category: "Software",
    body: (go, year) => <>
      <p>A <b>web hosting control panel</b> is software that splits one server into many small web spaces and lets each customer manage their own websites, databases and mail boxes through a web page. It is what makes <W slug="Web_hosting" go={go}>shared web hosting</W> possible: one server serves hundreds of small sites.</p>
      <p>A panel is installed on top of the <W slug="Operating_system" go={go}>operating system</W> with the commands from its website. A server that runs a <W slug="Hypervisor" go={go}>hypervisor</W> cannot run a panel beside it.</p>
      <h2>Panels</h2>
      <SoftwareTable kind="panel" year={year} go={go} />
      <h2>Licences</h2>
      <p>Commercial panels are paid per server or per hosted account every month. A free panel costs nothing but tends to cause more support tickets, because it offers customers fewer tools to help themselves.</p>
    </>,
  },
  {
    slug: "Hypervisor",
    title: "Hypervisor",
    category: "Software",
    body: (go, year) => <>
      <p>A <b>hypervisor</b> runs several virtual machines on one physical server. Each virtual machine behaves like a server of its own with its own <W slug="Operating_system" go={go}>operating system</W>, so a hosting company can rent out a slice of a large server as a <b>virtual private server</b> (VPS). Game servers are usually sold on virtual machines too.</p>
      <h2>Hypervisors</h2>
      <SoftwareTable kind="cloud" year={year} go={go} />
      <h2>Features</h2>
      <p>The better hypervisors can move a running virtual machine to another server without stopping it, which allows maintenance without downtime. Some can also lend unused memory from one virtual machine to another. Several servers running the same hypervisor are joined into a <b>cluster</b>.</p>
      <h2>See also</h2>
      <ul><li><W slug="Web_hosting_control_panel" go={go}>Web hosting control panel</W></li></ul>
    </>,
  },
  {
    slug: "Email_blacklist",
    title: "Email blacklist",
    category: "Networking",
    body: (go) => <>
      <p>An <b>email blacklist</b> is a public list of <W slug="IP_address" go={go}>IP addresses</W> that are known to send spam. Mail servers around the world check incoming mail against these lists and reject or bounce mail from listed addresses.</p>
      <h2>Getting listed</h2>
      <p>An address gets listed when spam is sent from it. This often happens without the owner's knowledge: a hacked website or an outdated control panel is enough for spammers to send thousands of mails a day. Customers who send spam on purpose, or a flood of abuse reports, have the same effect.</p>
      <p>Dynamic addresses of home lines such as <W slug="Digital_subscriber_line" go={go}>DSL</W> are listed as a whole and stay listed, because real mail servers are not expected to run on them. A hosting company on a home line therefore cannot send mail from its own server.</p>
      <h2>Reputation</h2>
      <p>Blacklist operators keep a reputation score for each address. A fresh static address starts at {REP.fresh}, and a static business line at {REP.staticLine}. Every thousand spam mails costs {REP.perThousand} points, and each clean day earns {REP.recover} back. Below {REP.listAt} the address is listed, and it stays listed until it climbs back to {REP.clearAt}.</p>
      <h2>Delisting</h2>
      <p>The owner of a listed address can ask the operator for removal once the spam has stopped. The request takes about {DELIST_HOURS} hours and raises the score by {REP.delist}. While an address is listed, customers whose mail bounces write to support.</p>
    </>,
  },
  {
    slug: "Web_hosting",
    title: "Web hosting",
    category: "Business",
    body: (go) => <>
      <p><b>Web hosting</b> is the business of renting out space on a server that is connected to the internet, so that customers can publish websites without running servers themselves.</p>
      <h2>Kinds of hosting</h2>
      <table className="wk-table">
        <thead><tr><th>Product</th><th>What the customer gets</th></tr></thead>
        <tbody>
          <tr><td>Shared web hosting</td><td>A web space on a server shared with many other customers, managed through a <W slug="Web_hosting_control_panel" go={go}>control panel</W>.</td></tr>
          <tr><td>Virtual private server</td><td>A virtual machine with its own operating system, running on a <W slug="Hypervisor" go={go}>hypervisor</W>.</td></tr>
          <tr><td>Game server</td><td>A virtual machine running a multiplayer game, which needs its own <W slug="IP_address" go={go}>IP address</W>.</td></tr>
          <tr><td>Dedicated server</td><td>A whole physical server rented to one customer, usually for a year or more.</td></tr>
          <tr><td>Colocation</td><td>Rack space, power and network for a server the customer owns, see <W slug="Colocation" go={go}>colocation</W>.</td></tr>
        </tbody>
      </table>
      <h2>Customers</h2>
      <p>Hosting customers range from hobbyists with a single home page to agencies and online shops. Private customers mostly look at the price, while businesses expect their sites to stay online and their questions to be answered quickly. A customer who is unhappy with uptime, speed or support moves to another host.</p>
      <h2>Starting out</h2>
      <p>Most hosting companies start with shared web hosting, because a single server with a control panel can serve many small customers on a home line. See <W slug="Help:Starting_a_hosting_company" go={go}>starting a hosting company</W>.</p>
    </>,
  },
];
