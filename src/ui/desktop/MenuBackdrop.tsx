import { useEffect, useState } from "react";

const SCRIPT = [
  "root@web01:~# uptime",
  " 14:02:11 up 212 days,  3:41,  2 users,  load average: 0.42, 0.38, 0.31",
  "root@web01:~# df -h /var",
  "/dev/sda3   120G   88G   26G  78% /var",
  "root@web01:~# tail -n 4 /var/log/access.log",
  '203.0.113.7 "GET /shop/cart HTTP/1.1" 200 5120',
  '198.51.100.23 "GET /index.php HTTP/1.1" 200 8731',
  '203.0.113.99 "POST /order HTTP/1.1" 302 0',
  '192.0.2.14 "GET /img/logo.png HTTP/1.1" 304 0',
  "root@web01:~# ping -c 2 customer-gw",
  "64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=0.31 ms",
  "64 bytes from 10.0.0.1: icmp_seq=2 ttl=64 time=0.29 ms",
  "root@web01:~# service web restart",
  " * Restarting web server                 [ OK ]",
  "root@web01:~# ",
].join("\n");

const BARS = Array.from({ length: 28 }, (_, i) => ({ delay: -((i * 37) % 11) * 0.4, time: 2.4 + ((i * 7) % 5) * 0.5 }));

// A looping 2012 desktop behind the main menu: someone typing in a terminal next to a traffic monitor.
export function MenuBackdrop() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(SCRIPT.length);
    const id = setInterval(() => setN((c) => (c > SCRIPT.length + 60 ? 0 : c + 1)), 55);
    return () => clearInterval(id);
  }, []);
  const lines = SCRIPT.slice(0, n).split("\n").slice(-13);
  return (
    <div className="mbd" aria-hidden="true">
      <div className="mbd-win mbd-term">
        <div className="mbd-title">root@web01: ~</div>
        <pre>{lines.join("\n")}<i className="mbd-caret" /></pre>
      </div>
      <div className="mbd-win mbd-mon">
        <div className="mbd-title">Traffic monitor</div>
        <div className="mbd-chart">
          {BARS.map((b, i) => <i key={i} style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.time}s` }} />)}
        </div>
        <div className="mbd-stats"><span>Requests</span><span>Load</span><span>Disk</span></div>
      </div>
      <div className="mbd-cursor" />
      <div className="mbd-task"><span className="mbd-orb" /><span className="mbd-tab">root@web01: ~</span><span className="mbd-tab">Traffic monitor</span><span className="mbd-clock">14:02</span></div>
    </div>
  );
}
