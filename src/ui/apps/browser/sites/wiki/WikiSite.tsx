import type { ReactNode } from "react";
import type { GameState } from "../../../../../sim/50-state";
import { displayHost, WIKI_HOST, WIKI_URL } from "../../../../../sim/80-business/browser";
import { serverOsById } from "../../../../../sim/10-catalog/server-os";
import { MOMS_DSL } from "../../../../../sim/20-world/datacenters";
import { RECONNECT_HOUR } from "../../../../../sim/10-catalog/addresses";
import "./wiki.css";

type Go = (url: string) => void;
interface Article { slug: string; title: string; body: (go: Go) => ReactNode }

const wikiUrl = (slug: string) => `www.${WIKI_HOST}/wiki/${slug}`;
const A = ({ to, go, children }: { to: string; go: Go; children: ReactNode }) => (
  <a href={`#${to}`} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);
const W = ({ slug, go, children }: { slug: string; go: Go; children: ReactNode }) => <A to={wikiUrl(slug)} go={go}>{children}</A>;

const os = serverOsById("lunix");
const osUrl = `${displayHost(os.site.host)}/`;
const reconnect = `${String(RECONNECT_HOUR).padStart(2, "0")}:00`;

const ARTICLES: Article[] = [
  {
    slug: "Server_installation",
    title: "Server installation",
    body: (go) => <>
      <p><b>Server installation</b> is the process of bringing a new server from its box to a running <W slug="Operating_system" go={go}>operating system</W>. A bare server ships with empty disks, so it cannot do anything until an operating system has been installed from removable media such as a USB stick.</p>
      <h2>Mounting and power</h2>
      <p>The server is first mounted in a rack. Each power supply on the back then has to be plugged into a socket or a power strip. A server with redundant power supplies keeps running when one of them loses power, as long as the other one is still plugged in.</p>
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
      <p>After the operating system runs, further software such as a hypervisor or a web hosting panel is installed with the commands given on that software's website.</p>
    </>,
  },
  {
    slug: "Uplink",
    title: "Uplink",
    body: (go) => <>
      <p>An <b>uplink</b> is the connection that carries a network's traffic toward a larger network, and in the end toward the internet.</p>
      <p>In a home network the router is the uplink for every device cabled to it. The router itself is connected to the internet line, so a server that is cabled to the router reaches the internet through that line. The speed of the line, especially its upload rate, limits how much traffic the servers behind it can send to visitors.</p>
      <p>In a datacenter the servers are cabled to a switch, and the datacenter connects its racks to one or more transit providers. These connections are much faster than a home line and come with fixed addresses.</p>
      <h2>See also</h2>
      <ul>
        <li><W slug="Digital_subscriber_line" go={go}>Digital subscriber line</W></li>
        <li><W slug="Server_installation" go={go}>Server installation</W></li>
      </ul>
    </>,
  },
  {
    slug: "Digital_subscriber_line",
    title: "Digital subscriber line",
    body: (go) => <>
      <p><b>Digital subscriber line</b> (<b>DSL</b>) is a technology that carries internet access over an ordinary telephone line. It is the most common way households connect to the internet.</p>
      <h2>Speeds</h2>
      <p>Home DSL is asymmetric: the download rate is much higher than the upload rate. A typical private line such as DSL 6000 offers {MOMS_DSL.down} Mbit/s down and only about {MOMS_DSL.up} Mbit/s up. For people who serve websites from home the upload rate matters most, because every page a visitor loads is sent upstream.</p>
      <h2>Dynamic addresses</h2>
      <p>A private line gets a single <b>dynamic</b> IP address. The provider disconnects the line once a day, usually at night around {reconnect}, and assigns a new address on reconnect. Mail servers widely block addresses from dynamic ranges, and services that customers reach by address stop working whenever it changes. For that reason a dynamic line is usually only good for web hosting, with the domain kept pointing at the current address.</p>
      <p>Business lines cost more but come with several <b>static</b> addresses that never change and no daily disconnect.</p>
      <h2>Getting a line</h2>
      <p>Ordering a new line takes from one to several weeks until a technician has connected it. Many small hosting companies therefore start on the family's existing private line and switch to a business line once they have paying customers.</p>
      <h2>See also</h2>
      <ul><li><W slug="Uplink" go={go}>Uplink</W></li></ul>
    </>,
  },
  {
    slug: "Operating_system",
    title: "Operating system",
    body: (go) => <>
      <p>An <b>operating system</b> is the software that runs a computer's hardware and the programs on it. Servers mostly run a free Unix-like system such as <A to={osUrl} go={go}>{os.name}</A>, or a commercial one when customers need its software.</p>
      <p>A new server has no operating system. It is installed from a USB stick, see <W slug="Server_installation" go={go}>server installation</W>.</p>
    </>,
  },
];

function MainPage({ go }: { go: Go }) {
  return <>
    <p>Welcome to <b>Wikipedio</b>, the free encyclopedia that anyone can edit.</p>
    <h2>Articles</h2>
    <ul>{ARTICLES.map((a) => <li key={a.slug}><W slug={a.slug} go={go}>{a.title}</W></li>)}</ul>
  </>;
}

export function WikiSite({ path, go }: { game: GameState; path: string; go: Go }) {
  const slug = decodeURIComponent(path.replace(/^\/wiki\//, "").replace(/\/$/, "")) || "Main_Page";
  const article = ARTICLES.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
  const main = slug === "Main_Page" || path === "/";
  const title = main ? "Main Page" : article?.title ?? slug.replace(/_/g, " ");
  return (
    <div className="wk">
      <nav className="wk-side">
        <A to={WIKI_URL} go={go}><span className="wk-logo">W</span><span className="wk-name">Wikipedio</span></A>
        <ul>
          <li><A to={WIKI_URL} go={go}>Main Page</A></li>
          {ARTICLES.map((a) => <li key={a.slug}><W slug={a.slug} go={go}>{a.title}</W></li>)}
        </ul>
      </nav>
      <main className="wk-page">
        <h1>{title}</h1>
        {!main && <div className="wk-from">From Wikipedio, the free encyclopedia</div>}
        {main ? <MainPage go={go} /> : article ? article.body(go) : <p>Wikipedio does not have an article with this exact name.</p>}
      </main>
    </div>
  );
}
