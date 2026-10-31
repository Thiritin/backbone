import { useEffect, useState, type CSSProperties } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { APPS } from "../apps/registry";

const SCRIPT = [
  "root@web01:~# uptime",
  " 14:02:11 up 212 days,  3:41,  2 users,  load average: 0.42, 0.38, 0.31",
  "root@web01:~# df -h /var",
  "/dev/sda3   120G   88G   26G  78% /var",
  "root@web01:~# tail -n 3 /var/log/access.log",
  '203.0.113.7 "GET /shop/cart HTTP/1.1" 200 5120',
  '198.51.100.23 "GET /index.php HTTP/1.1" 200 8731',
  '203.0.113.99 "POST /order HTTP/1.1" 302 0',
  "root@web01:~# ping -c 2 customer-gw",
  "64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.31 ms",
  "64 bytes from 10.0.0.1: icmp_seq=2 ttl=64 time=0.29 ms",
  "root@web01:~# ",
].join("\n");

const BARS = Array.from({ length: 24 }, (_, i) => ({ delay: -((i * 37) % 11) * 0.4, time: 2.4 + ((i * 7) % 5) * 0.5 }));
const DOCK = APPS.filter((a) => !a.hidden && a.name !== "Settings").slice(0, 10);

// The desktop of the 2018 build, drawn with the game's own shell classes, as if someone were playing behind the main menu.
export function MenuBackdrop() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(SCRIPT.length);
    const id = setInterval(() => setN((c) => (c > SCRIPT.length + 60 ? 0 : c + 1)), 55);
    return () => clearInterval(id);
  }, []);
  const lines = SCRIPT.slice(0, n).split("\n").slice(-12);
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
      <section className="window front" style={{ right: "34%", top: 250, width: "32%", height: 280, zIndex: 2 }}>
        <div className="titlebar"><div className="lights"><button /><button /><button /></div><h1>Network</h1></div>
        <div className="win-body mbd-chart">{BARS.map((b, i) => <i key={i} style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.time}s` }} />)}</div>
      </section>
      <nav className="dock">
        {DOCK.map((a) => (
          <span key={a.name} className="dock-app"><span className="dock-tile" style={{ "--tile": a.tile } as CSSProperties}><a.icon /></span></span>
        ))}
      </nav>
    </div>
  );
}
