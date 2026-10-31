import { useEffect, useState, type CSSProperties } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { APPS } from "../apps/registry";

const PROMPT = "root@web01:~# ";
// Each command is typed, then its output appears at once a moment later.
const STEPS = [
  { cmd: "uptime", out: " 14:02:11 up 212 days,  3:41,  2 users,  load average: 0.42, 0.38, 0.31" },
  { cmd: "df -h /var", out: "/dev/sda3   120G   88G   26G  78% /var" },
  { cmd: "tail -n 3 /var/log/access.log", out: '203.0.113.7 "GET /shop/cart HTTP/1.1" 200 5120\n198.51.100.23 "GET /index.php HTTP/1.1" 200 8731\n203.0.113.99 "POST /order HTTP/1.1" 302 0' },
  { cmd: "ping -c 2 customer-gw", out: "64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.31 ms\n64 bytes from 10.0.0.1: icmp_seq=2 ttl=64 time=0.29 ms" },
];
const THINK = 18, READ = 40;
const LOOP = STEPS.reduce((n, s) => n + s.cmd.length + THINK + READ, 0);

const terminalAt = (tick: number): string => {
  const lines: string[] = [];
  let t = tick % LOOP;
  for (const s of STEPS) {
    if (t < s.cmd.length) return [...lines, PROMPT + s.cmd.slice(0, t)].join("\n");
    lines.push(PROMPT + s.cmd);
    t -= s.cmd.length;
    if (t < THINK) return lines.join("\n");
    lines.push(s.out);
    t -= THINK + READ;
    if (t < 0) return lines.join("\n");
  }
  return lines.join("\n");
};

const VMS = [
  { name: "vm-0412", customer: "Bäckerei Hoffmann", cpu: 34, ram: 52 },
  { name: "vm-0398", customer: "Nordlicht Webdesign", cpu: 71, ram: 64 },
  { name: "vm-0377", customer: "Müller & Söhne GmbH", cpu: 18, ram: 40 },
  { name: "vm-0365", customer: "Pixelgarten", cpu: 88, ram: 79 },
  { name: "vm-0351", customer: "Café Lindenhof", cpu: 12, ram: 27 },
  { name: "vm-0340", customer: "Studio Waldmeister", cpu: 46, ram: 58 },
];
const DOCK = APPS.filter((a) => !a.hidden && a.name !== "Settings").slice(0, 10);

// The desktop of the 2018 build, drawn with the game's own shell classes, as if someone were playing behind the main menu.
export function MenuBackdrop() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setTick(LOOP - 1);
    const id = setInterval(() => setTick((c) => c + 1), 55);
    return () => clearInterval(id);
  }, []);
  const lines = terminalAt(tick).split("\n").slice(-12);
  return (
    <div className="mbd" aria-hidden="true" inert>
      <header className="menubar">
        <span className="mb-item mb-app">Backbone</span>
        <span className="mb-item">Window</span>
        <span className="mb-spacer" />
        <div className="speed"><button><Pause /></button><button aria-pressed="true"><span className="arrows"><Play /></span></button><button><span className="arrows"><Play /><Play /></span></button><button><SkipForward className="skip" /></button></div>
        <span className="mb-sep" />
        <span className="mb-item num">Wed, 14 Feb 2018 · 14:02</span>
        <span className="mb-sep" />
        <span className="mb-item mb-cash num">€ 1,284,300</span>
      </header>
      <section className="window" style={{ left: "6%", top: 150, width: "46%", height: 300, zIndex: 1 }}>
        <div className="titlebar"><div className="lights"><button /><button /><button /></div><h1>Terminal</h1></div>
        <div className="win-body mbd-term"><pre>{lines.join("\n")}<i className="mbd-caret" /></pre></div>
      </section>
      <section className="window front" style={{ left: "34%", top: 290, width: "min(440px, 34%)", height: 310, zIndex: 2 }}>
        <div className="titlebar"><div className="lights"><button /><button /><button /></div><h1>Virtual machines</h1></div>
        <div className="win-body mbd-vms">
          {VMS.map((v, i) => (
            <div key={v.name} className="mbd-vm">
              <span className="mbd-vm-name"><strong>{v.customer}</strong><small>{v.name}</small></span>
              <span className="mbd-meter"><i style={{ "--w": `${v.cpu}%`, animationDelay: `${-i * 0.9}s` } as CSSProperties} /></span>
              <span className="mbd-meter"><i style={{ "--w": `${v.ram}%`, animationDelay: `${-i * 1.3}s` } as CSSProperties} /></span>
            </div>
          ))}
        </div>
      </section>
      <nav className="dock">
        {DOCK.map((a) => (
          <span key={a.name} className="dock-app"><span className="dock-tile" style={{ "--tile": a.tile } as CSSProperties}><a.icon /></span></span>
        ))}
      </nav>
    </div>
  );
}
