// Backbone mockups: renders the shared desktop (wallpaper, menu bar, dock) and code-drawn device fronts.

const APPS = [
  { name: "Locations", icon: "server", tile: "oklch(0.5 0.06 250)" },
  { name: "Network", icon: "globe", tile: "oklch(0.58 0.12 210)" },
  { name: "Products", icon: "package", tile: "oklch(0.55 0.17 295)" },
  { name: "Customers", icon: "users", tile: "oklch(0.52 0.17 268)" },
  { name: "Support", icon: "life-buoy", tile: "oklch(0.62 0.19 35)" },
  { name: "Billing", icon: "receipt", tile: "oklch(0.6 0.14 160)" },
  { name: "Finance", icon: "chart-line", tile: "oklch(0.55 0.13 175)" },
  { name: "Bank", icon: "landmark", tile: "oklch(0.45 0.04 255)" },
  { name: "Staff", icon: "contact", tile: "oklch(0.7 0.15 70)" },
  { name: "Marketing", icon: "megaphone", tile: "oklch(0.62 0.19 350)" },
  { name: "Market", icon: "chart-pie", tile: "oklch(0.62 0.12 230)" },
  { name: "Unlocks", icon: "lightbulb", tile: "oklch(0.72 0.15 95)" },
];

const appTile = (name) => APPS.find((a) => a.name === name)?.tile;

function wallpaper() {
  const cities = [
    ["London", -0.13, 51.5], ["Paris", 2.35, 48.86], ["Amsterdam", 4.9, 52.37], ["Frankfurt", 8.68, 50.11],
    ["Berlin", 13.4, 52.52], ["Zurich", 8.54, 47.37], ["Milan", 9.19, 45.46], ["Vienna", 16.37, 48.21],
  ];
  const far = [["Stockholm", 18.07, 59.33], ["Madrid", -3.7, 40.42], ["New York", -14, 47], ["Warsaw", 21.0, 52.23]];
  const W = 1440, H = 900;
  const p = (lon, lat) => [((lon + 14) / 40) * W, ((60.5 - lat) / 23) * H];
  const links = [
    ["Frankfurt", "Amsterdam"], ["Frankfurt", "Paris"], ["Frankfurt", "Berlin"], ["Frankfurt", "Zurich"], ["Frankfurt", "Vienna"],
    ["Amsterdam", "London"], ["London", "Paris"], ["Paris", "Milan"], ["Zurich", "Milan"], ["Berlin", "Vienna"],
    ["Amsterdam", "Berlin"], ["Milan", "Vienna"], ["London", "New York"], ["Amsterdam", "Stockholm"], ["Paris", "Madrid"], ["Berlin", "Warsaw"],
  ];
  const all = Object.fromEntries([...cities, ...far].map(([n, lon, lat]) => [n, p(lon, lat)]));
  const arc = ([a, b]) => {
    const [x1, y1] = all[a], [x2, y2] = all[b];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18;
    return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}"/>`;
  };
  let dots = "";
  for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) dots += `M${x} ${y}h0.01`;
  const city = ([n]) => {
    const [x, y] = all[n];
    return `<circle cx="${x}" cy="${y}" r="9" fill="oklch(0.75 0.13 230 / 0.12)"/><circle cx="${x}" cy="${y}" r="3.2" fill="oklch(0.86 0.1 220)"/>
      <text x="${x + 10}" y="${y - 8}">${n.toUpperCase()}</text>`;
  };
  const farCity = ([n]) => { const [x, y] = all[n]; return `<circle cx="${x}" cy="${y}" r="2.2" fill="oklch(0.7 0.06 240 / 0.6)"/>`; };
  return `<svg class="wallpaper" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="wp" cx="55%" cy="45%" r="75%"><stop offset="0" stop-color="oklch(0.34 0.07 255)"/><stop offset="0.6" stop-color="oklch(0.24 0.06 262)"/><stop offset="1" stop-color="oklch(0.16 0.04 270)"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#wp)"/>
    <path d="${dots}" stroke="oklch(0.8 0.05 240 / 0.12)" stroke-width="2" stroke-linecap="round"/>
    <g fill="none" stroke="oklch(0.8 0.11 220 / 0.32)" stroke-width="1.2">${links.map(arc).join("")}</g>
    <g>${far.map(farCity).join("")}</g>
    <g font-family="JetBrains Mono, monospace" font-size="10" letter-spacing="0.08em" fill="oklch(0.85 0.05 230 / 0.55)">${cities.map(city).join("")}</g>
  </svg>`;
}

function menubar({ app, speed = "2" }) {
  const speeds = [["pause", '<i data-lucide="pause"></i>'], ["1", "1×"], ["2", "2×"], ["4", "4×"], ["8", "8×"]];
  return `<header class="menubar" role="menubar">
    <span class="mb-item mb-logo" title="Backbone"><i data-lucide="network"></i></span>
    <span class="mb-item mb-app">${app}</span>
    ${["File", "Edit", "View", "Window"].map((m) => `<span class="mb-item">${m}</span>`).join("")}
    <span class="mb-spacer"></span>
    <div class="speed" role="group" aria-label="Game speed">
      ${speeds.map(([k, l]) => `<button aria-pressed="${k === speed}" aria-label="${k === "pause" ? "Pause" : k + "× speed"}">${l}</button>`).join("")}
    </div>
    <span class="mb-sep"></span>
    <span class="mb-item num">Thu 14 Sep 2006 · 14:00</span>
    <span class="mb-sep"></span>
    <span class="mb-item mb-cash num">€18,240</span>
    <span class="mb-item mb-badge" title="Open tickets"><i data-lucide="inbox"></i><span class="count">7</span></span>
    <span class="mb-item" title="Notifications"><i data-lucide="bell"></i></span>
    <button class="mb-item" id="theme-toggle" style="border:0;background:none" aria-label="Toggle dark mode"><i data-lucide="moon"></i></button>
  </header>`;
}

function dock({ running = [], badges = {} }) {
  const item = (a) => `<div class="dock-app${running.includes(a.name) ? " running" : ""}">
      <span class="tip">${a.name}</span>
      <div class="dock-tile" style="--tile:${a.tile}"><i data-lucide="${a.icon}"></i></div>
      ${badges[a.name] ? `<span class="count">${badges[a.name]}</span>` : ""}
      <span class="dot"></span>
    </div>`;
  return `<nav class="dock" aria-label="Apps">${APPS.slice(0, 4).map(item).join("")}<span class="dock-divider"></span>${APPS.slice(4, 8).map(item).join("")}<span class="dock-divider"></span>${APPS.slice(8).map(item).join("")}</nav>`;
}

// Device fronts. All sizes in px; u = height of one rack unit.

const LED = { ok: "oklch(0.78 0.2 145)", warn: "oklch(0.83 0.17 80)", bad: "oklch(0.66 0.23 27)", off: "oklch(0.4 0.01 255)", act: "oklch(0.8 0.14 225)", fiber: "oklch(0.8 0.12 195)" };
const CABLE = { copper: "oklch(0.62 0.14 250)", fiber: LED.fiber, uplink: "oklch(0.82 0.15 90)" };

function ears(w, h, fill = "var(--metal)") {
  return `<rect x="0" y="0.5" width="${w}" height="${h - 1}" rx="1.5" fill="${fill}" stroke="var(--metal-line)"/>
    <rect x="3" y="${h / 2 - 2}" width="4" height="4" rx="1" fill="var(--metal-line)"/><rect x="${w - 7}" y="${h / 2 - 2}" width="4" height="4" rx="1" fill="var(--metal-line)"/>`;
}

function label(x, y, text, size = 6.5, anchor = "start", fill = "oklch(0.78 0.01 255)") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="JetBrains Mono, monospace" font-size="${size}" fill="${fill}" letter-spacing="0.04em">${text}</text>`;
}

// Device label size grows with the unit height; tw estimates a mono label's width.
const fsz = (h) => Math.max(6.5, Math.min(10.5, h * 0.42));
const tw = (t, fs) => t.length * fs * 0.62;

const hex = (cx, cy, r) => `M${cx} ${cy - r}l${0.866 * r} ${0.5 * r}v${r}l${-0.866 * r} ${0.5 * r}l${-0.866 * r} ${-0.5 * r}v${-r}z`;

// Bezel textures shared by every device <svg> on the page.
const DEFS = `<defs>
  <pattern id="bb-hex" width="3.46" height="6" patternUnits="userSpaceOnUse">
    <rect width="3.46" height="6" fill="oklch(0.4 0.006 255)"/>
    <path d="${hex(0, 0, 1.55)}${hex(3.46, 0, 1.55)}${hex(1.73, 3, 1.55)}${hex(0, 6, 1.55)}${hex(3.46, 6, 1.55)}" fill="oklch(0.12 0.004 255)"/>
  </pattern>
  <pattern id="bb-perf" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
    <rect width="2.6" height="2.6" fill="oklch(0.66 0.006 255)"/><circle cx="1.3" cy="1.3" r="0.75" fill="oklch(0.3 0.006 255)"/>
  </pattern>
</defs>`;

const statusLeds = (w, h, state) =>
  `<circle cx="${w - 22}" cy="${h / 2}" r="1.8" fill="${LED[state]}"/><circle cx="${w - 15}" cy="${h / 2}" r="1.8" fill="${state === "off" ? LED.off : LED.ok}"/>`;

// Fronts follow the look of the three big server brands; names are parodies.
const SERVER_BRANDS = {
  // Dwell PowerEdgy: hex-mesh bezel over the drives, badge in the middle.
  dwell({ w, h, state, name }) {
    const fs = fsz(h);
    return ears(w, h, "oklch(0.22 0.006 255)")
      + `<rect x="11" y="1.5" width="${w - 22}" height="${h - 3}" rx="1.5" fill="url(#bb-hex)"/>`
      + (name ? `<rect x="14" y="2.5" width="${tw(name, fs) + 10}" height="${h - 5}" rx="1" fill="oklch(0.14 0.004 255)"/>` + label(19, h / 2 + fs * 0.35, name, fs) : "")
      + `<rect x="${w / 2 - 9}" y="${h * 0.34}" width="18" height="${h * 0.32}" rx="1" fill="oklch(0.7 0.01 255)"/>`
      + `<rect x="${w - 28}" y="2.5" width="18" height="${h - 5}" rx="1" fill="oklch(0.14 0.004 255)"/>` + statusLeds(w, h, state);
  },
  // Hewlett-Packet ProLight: silver chassis, pull tab, drive trays, perforated grille.
  hp({ w, h, state, name }) {
    const fs = fsz(h), tab = name ? tw(name, fs) + 10 : 20, bw = w * 0.075, bx = 14 + tab;
    let s = ears(w, h, "oklch(0.7 0.005 255)")
      + `<rect x="10" y="${h * 0.14}" width="${tab}" height="${h * 0.72}" rx="1" fill="oklch(0.9 0.004 255)"/>` + label(15, h / 2 + fs * 0.35, name, fs, "start", "oklch(0.3 0.01 255)");
    for (let i = 0; i < 4; i++) {
      const x = bx + i * (bw + 1.5);
      s += `<rect x="${x}" y="2" width="${bw}" height="${h - 4}" rx="0.8" fill="oklch(0.3 0.006 255)"/>
        <circle cx="${x + 3.2}" cy="${h / 2}" r="1.3" fill="none" stroke="${state === "bad" && i === 1 ? LED.bad : LED.ok}" stroke-width="0.8"/>`;
    }
    const px = bx + 4 * (bw + 1.5) + 3;
    return s + `<rect x="${px}" y="2" width="${w - 30 - px}" height="${h - 4}" rx="0.8" fill="url(#bb-perf)"/>` + statusLeds(w, h, state);
  },
  // SuperMacro: black chassis, silver drive trays, plain front panel.
  sm({ w, h, state, name }) {
    const bw = w * 0.09;
    let s = ears(w, h, "oklch(0.15 0.004 255)");
    for (let i = 0; i < 4; i++) {
      const x = 12 + i * (bw + 1.5);
      s += `<rect x="${x}" y="2" width="${bw}" height="${h - 4}" rx="0.6" fill="oklch(0.6 0.006 255)"/>
        <rect x="${x + 2}" y="${h / 2 - 0.8}" width="${bw - 8}" height="1.6" fill="oklch(0.2 0.004 255)"/>
        <circle cx="${x + bw - 3}" cy="${h / 2}" r="1.1" fill="${state === "bad" && i === 1 ? LED.bad : LED.act}"/>`;
    }
    return s + label(w - 30, h / 2 + fsz(h) * 0.35, name, fsz(h), "end") + statusLeds(w, h, state);
  },
};

const devices = {
  server({ w, u, state = "ok", name = "", brand = "sm" }) {
    return SERVER_BRANDS[brand]({ w, h: u, state, name });
  },
  storage({ w, u, state = "ok", name = "" }) {
    const h = u * 2, cols = 4, rows = 3, bw = (w * 0.5) / cols, bh = (h - 8) / rows;
    let s = ears(w, h, "oklch(0.15 0.004 255)");
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = 12 + c * bw, y = 4 + r * bh;
      s += `<rect x="${x}" y="${y}" width="${bw - 2}" height="${bh - 1.5}" rx="1" fill="oklch(0.6 0.006 255)"/>
        <circle cx="${x + bw - 6}" cy="${y + bh / 2}" r="1.1" fill="${LED.act}"/>`;
    }
    return s + label(w - 30, h / 2 + fsz(u) * 0.35, name, fsz(u), "end") + statusLeds(w, h, state);
  },
  // Copper ports in pairs (top/bottom), then SFP cages. `fiber` makes every port an SFP cage.
  switch({ w, u, n = 48, sfp = 4, fiber = false, ports = [], name = "", selected = -1, groups = [] }) {
    const h = u, fs = fsz(h) * 0.9, x0 = name ? 18 + tw(name, fs) : 16, pw = (w - x0 - 32) / 28, ph = (h - 6) / 2;
    const at = (i) => { const col = Math.floor(i / 2); return [x0 + col * pw + Math.floor(col / 6) * 2, 3 + (i % 2) * ph]; };
    let s = ears(w, h) + label(10, h / 2 + fs * 0.35, name, fs);
    const cage = (x, y, cw, chh, st, sel) => `<rect x="${x}" y="${y}" width="${cw}" height="${chh}" rx="0.6" fill="oklch(0.14 0.005 255)" stroke="${sel ? "var(--accent)" : "var(--metal-3)"}" stroke-width="${sel ? 1.6 : 0.5}"/>`
      + (st && st !== "off" ? `<rect x="${x + cw * 0.22}" y="${y + chh * 0.25}" width="${cw * 0.22}" height="${chh * 0.5}" fill="${CABLE.fiber}"/><rect x="${x + cw * 0.56}" y="${y + chh * 0.25}" width="${cw * 0.22}" height="${chh * 0.5}" fill="${CABLE.fiber}"/>` : "");
    for (let i = 0; i < n; i++) {
      const [x, y] = at(i), st = ports[i] || "off", sel = i === selected;
      if (fiber) { s += cage(x, y, pw - 1.6, ph - 1, st, sel); continue; }
      s += `<rect x="${x}" y="${y}" width="${pw - 1.6}" height="${ph - 1}" rx="0.6" fill="${st === "off" ? "var(--metal-line)" : "oklch(0.14 0.005 255)"}" ${sel ? 'stroke="var(--accent)" stroke-width="1.6"' : ""}/>`;
      if (st !== "off") s += `<rect x="${x + pw * 0.1}" y="${y + (i % 2 ? ph * 0.82 - 1.4 : ph * 0.06)}" width="${pw * 0.22}" height="${Math.max(1.4, ph * 0.12)}" fill="${LED[st]}"/>`;
    }
    const sx = x0 + 24 * pw + 12;
    for (let i = 0; i < sfp; i++) s += cage(sx + i * pw, 3.5, pw * 0.85, h - 7, ports[n + i], n + i === selected);
    for (const [a, b] of groups) {
      const [xa, ya] = at(a), [xb, yb] = at(b);
      s += `<rect x="${xa - 2}" y="${Math.min(ya, yb) - 1.6}" width="${xb - xa + pw + 2.4}" height="${Math.abs(yb - ya) + ph + 2.2}" rx="2" fill="none" stroke="oklch(0.74 0.14 300)" stroke-width="1.2" stroke-dasharray="3 2"/>`;
    }
    return s;
  },
  router({ w, u, name = "" }) {
    const h = u;
    let s = ears(w, h) + label(12, h / 2 + fsz(h) * 0.35, name, fsz(h));
    for (let i = 0; i < 8; i++) s += `<rect x="${w * 0.42 + i * 11}" y="3.5" width="9" height="${h - 7}" rx="0.6" fill="oklch(0.14 0.005 255)" stroke="${i < 3 ? LED.ok : "var(--metal-line)"}" stroke-width="0.6"/>`;
    return s + statusLeds(w, h, "ok");
  },
  // Keystone jacks; a plugged jack shows its cable boot in the cable's colour.
  patch({ w, u, n = 24, ports = [], name = "" }) {
    const h = u, fs = fsz(h) * 0.9, x0 = name ? 18 + tw(name, fs) : 16, pw = (w - x0 - 14) / n;
    let s = ears(w, h, "oklch(0.2 0.005 255)") + label(10, h / 2 + fs * 0.35, name, fs);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * pw + Math.floor(i / 6) * 0.8, c = CABLE[ports[i]];
      s += `<rect x="${x}" y="3" width="${pw - 1.4}" height="${h - 6}" rx="0.6" fill="oklch(0.12 0.004 255)"/>`;
      if (c) s += `<rect x="${x + pw * 0.15}" y="${h * 0.3}" width="${pw - 1.4 - pw * 0.3}" height="${h * 0.4}" rx="0.6" fill="${c}"/>`;
    }
    return s;
  },
  blank({ w, u }) {
    const h = u;
    let s = `<rect x="0" y="0.5" width="${w}" height="${h - 1}" rx="1" fill="oklch(0.21 0.006 255)" stroke="var(--metal-line)"/>`;
    for (let x = 14; x < w - 14; x += 6) s += `<circle cx="${x}" cy="${h / 2}" r="1" fill="oklch(0.15 0.005 255)"/>`;
    return s;
  },
};

// Draws one device front as a standalone <svg>.
function deviceSVG(kind, opts) {
  const h = opts.u * (kind === "storage" ? 2 : 1);
  return `<svg class="device-svg" width="${opts.w}" height="${h}" viewBox="0 0 ${opts.w} ${h}" aria-label="${opts.name || kind}">${DEFS}${devices[kind](opts)}</svg>`;
}

// Port plan of fra1-sw-01, index = port number - 1. 49 to 52 are the SFP cages.
const SW01_PORTS = Array.from({ length: 52 }, (_, i) => (i < 20 ? "ok" : "off"));
SW01_PORTS[8] = "warn";
SW01_PORTS[48] = "fiber";
const SW01_GROUPS = [[0, 1], [2, 3]];

// Rented rack A07 at Interaction FRA1, top unit first.
const RACK_A07 = [
  { u: 42, kind: "patch", name: "fra1-pp-01", ports: { 0: "fiber", 1: "fiber", 12: "copper" } },
  { u: 41, kind: "switch", name: "fra1-sw-01", ports: SW01_PORTS },
  { u: 40, kind: "switch", name: "fra1-sw-02", ports: Array.from({ length: 52 }, (_, i) => (i < 2 || (i > 9 && i < 18) ? "ok" : "off")) },
  { u: 39, kind: "switch", name: "fra1-sw-03", n: 24, sfp: 2, ports: Array.from({ length: 26 }, (_, i) => (i < 7 ? "ok" : "off")) },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => ({ u: 38 - i, kind: "server", brand: "dwell", name: `fra1-vps-0${n}`, state: n === 4 ? "bad" : "ok" })),
  { u: 30, kind: "blank" },
  { u: 29, kind: "storage", name: "fra1-st-01" },
  ...["web-01", "web-02", "web-03"].map((n, i) => ({ u: 27 - i, kind: "server", brand: "hp", name: `fra1-${n}`, state: "ok" })),
  ...["game-01", "game-02", "game-03"].map((n, i) => ({ u: 24 - i, kind: "server", brand: "sm", name: `fra1-${n}`, state: "ok" })),
];

// Draws a rack column top unit first. Runs of 3+ empty units collapse into one "free" band.
function rackSVG(items, { w, u, units = 42, selected, numbers = true }) {
  const pad = numbers ? 30 : 4, fs = Math.max(7, u * 0.4), at = new Map();
  for (const it of items) for (let k = 0; k < (it.kind === "storage" ? 2 : 1); k++) at.set(it.u - k, it);
  let s = "", y = 4;
  for (let n = units; n >= 1;) {
    if (!at.has(n)) {
      let m = n;
      while (m >= 1 && !at.has(m)) m--;
      if (n - m >= 3) {
        const bh = u * 1.4;
        s += `<rect x="${pad}" y="${y + 1}" width="${w}" height="${bh - 2}" rx="2" fill="none" stroke="oklch(0.3 0.006 255)" stroke-dasharray="3 3"/>
          <text x="${pad + w / 2}" y="${y + bh / 2 + fs * 0.35}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${fs}" fill="oklch(0.62 0.01 255)">U${m + 1}–U${n} free</text>`;
        y += bh; n = m; continue;
      }
    }
    const it = at.get(n);
    if (numbers) s += `<text x="${pad - 8}" y="${y + u / 2 + fs * 0.35}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="${fs}" fill="oklch(0.62 0.01 255)">${n}</text>`;
    if (!it) s += `<rect x="${pad}" y="${y + 0.5}" width="${w}" height="${u - 1}" fill="oklch(0.2 0.006 255)" stroke="oklch(0.24 0.006 255)" stroke-width="0.5"/>`;
    else if (it.u === n) {
      const h = it.kind === "storage" ? 2 * u : u;
      s += `<g transform="translate(${pad} ${y})" data-device="${it.name || ""}">${devices[it.kind]({ ...it, w, u, name: numbers ? it.name : "" })}</g>`;
      if (it.name && it.name === selected) s += `<rect x="${pad - 2}" y="${y - 1.5}" width="${w + 4}" height="${h + 3}" rx="3" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
    }
    y += u; n--;
  }
  const H = y + 4, rail = (x) => `<rect x="${x}" y="2" width="5" height="${H - 4}" rx="1" fill="var(--metal-2)"/>`;
  return `<svg class="device-svg" width="${w + pad * 2}" height="${H}" viewBox="0 0 ${w + pad * 2} ${H}" role="img" aria-label="Rack front">${DEFS}
    <rect width="${w + pad * 2}" height="${H}" rx="4" fill="var(--rack)"/>${rail(pad - 6)}${rail(pad + w + 1)}${s}</svg>`;
}

// Street map of Frankfurt with a pin per site; districts are placed by eye.
function cityMap({ selected, H = 364 }) {
  const W = 360, top = -(H - 364) / 2, river = (x) => 236 + 16 * Math.sin(x / 58 + 0.6);
  let blocks = "";
  for (let x = 4; x < W; x += 21) for (let y = top + 4; y < top + H; y += 17) {
    if (Math.abs(y + 6 - river(x + 9)) < 20 || (x * 7 + y * 3) % 11 === 0) continue;
    blocks += `<rect x="${x}" y="${y}" width="${17 + ((x + y) % 3)}" height="${13}" rx="2"/>`;
  }
  const rv = Array.from({ length: 37 }, (_, i) => `${i ? "L" : "M"}${i * 10} ${river(i * 10).toFixed(1)}`).join("");
  const sites = [
    { id: "home", name: "Basement", x: 196, y: 112, state: "ok" },
    { id: "fra1", name: "Interaction FRA1", x: 268, y: 198, state: "bad" },
    { id: "ovh", name: "OVHalo FRA", x: 58, y: 176, state: "ok" },
  ];
  const pin = ({ id, name, x, y, state }) => {
    const sel = id === selected;
    return `<circle cx="${x}" cy="${y}" r="7.5" fill="${sel ? "var(--accent)" : "var(--win)"}" stroke="var(--accent)" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="2.6" fill="${sel ? "var(--accent-ink)" : "var(--accent)"}"/>
      ${state === "bad" ? `<circle cx="${x + 6.5}" cy="${y - 6.5}" r="3.6" fill="${LED.bad}" stroke="var(--map-bg)" stroke-width="1.5"/>` : ""}
      <text x="${x}" y="${y + 21}" text-anchor="middle" font-size="11" font-weight="${sel ? 650 : 550}" fill="var(--text)" stroke="var(--map-bg)" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">${name}</text>`;
  };
  const district = ([t, x, y]) => `<text x="${x}" y="${y}">${t}</text>`;
  return `<svg viewBox="0 ${top} ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of Frankfurt with your sites">
    <rect y="${top}" width="${W}" height="${H}" fill="var(--map-bg)"/>
    <g fill="var(--map-block)">${blocks}</g>
    <ellipse cx="300" cy="150" rx="26" ry="18" fill="var(--map-park)"/><ellipse cx="92" cy="70" rx="30" ry="20" fill="var(--map-park)"/><ellipse cx="190" cy="318" rx="40" ry="16" fill="var(--map-park)"/>
    <path d="${rv}" fill="none" stroke="var(--map-water)" stroke-width="15" stroke-linecap="round"/>
    <g fill="none" stroke="var(--map-road)" stroke-width="2.5" stroke-linecap="round">
      <ellipse cx="168" cy="190" rx="50" ry="32"/>
      <path d="M150 190 L178 330"/><path d="M200 196 L222 330"/><path d="M118 192 L60 300"/><path d="M168 158 L200 20"/><path d="M190 165 L250 60"/>
    </g>
    <g fill="none" stroke="var(--map-major)" stroke-width="4.5" stroke-linecap="round">
      <path d="M215 200 C 260 196, 310 190, 360 186"/><path d="M0 172 C 50 178, 90 186, 118 190"/><path d="M158 ${top} C 160 60, 166 120, 164 158"/>
      <path d="M318 ${top} C 312 90, 300 200, 312 ${top + H}"/>
    </g>
    <g font-family="JetBrains Mono, monospace" font-size="8.5" letter-spacing="0.14em" fill="var(--map-label)">
      ${[["INNENSTADT", 132, 186], ["BORNHEIM", 210, 84], ["OSTEND", 232, 168], ["SACHSENHAUSEN", 120, 284], ["GALLUS", 30, 150], ["NORDEND", 96, 122]].map(district).join("")}
    </g>
    <g font-family="Inter, sans-serif">${sites.map(pin).join("")}</g>
    <g font-family="JetBrains Mono, monospace" font-size="8" fill="var(--map-label)"><path d="M14 ${top + H - 16}h48" stroke="var(--map-label)" stroke-width="1.5"/><text x="14" y="${top + H - 22}">1 km</text></g>
  </svg>`;
}

function mountShell(opts) {
  const root = document.documentElement;
  const forced = new URLSearchParams(location.search).get("theme");
  if (forced) root.dataset.theme = forced;
  if (!root.dataset.theme) root.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const desktop = document.querySelector(".desktop");
  desktop.insertAdjacentHTML("afterbegin", wallpaper() + menubar(opts));
  desktop.insertAdjacentHTML("beforeend", dock(opts));
  document.getElementById("theme-toggle").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  });
  window.lucide?.createIcons();
}
