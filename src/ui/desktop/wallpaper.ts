// Night map of the Western European backbone; same drawing as docs/design/mockups/shell.js.
export function wallpaperSvg(): string {
  const cities = [
    ["London", -0.13, 51.5], ["Paris", 2.35, 48.86], ["Amsterdam", 4.9, 52.37], ["Frankfurt", 8.68, 50.11],
    ["Berlin", 13.4, 52.52], ["Zurich", 8.54, 47.37], ["Milan", 9.19, 45.46], ["Vienna", 16.37, 48.21],
  ];
  const far = [["Stockholm", 18.07, 59.33], ["Madrid", -3.7, 40.42], ["New York", -14, 47], ["Warsaw", 21.0, 52.23]];
  const W = 1440, H = 900;
  const p = (lon: number, lat: number): [number, number] => [((lon + 14) / 40) * W, ((60.5 - lat) / 23) * H];
  const links = [
    ["Frankfurt", "Amsterdam"], ["Frankfurt", "Paris"], ["Frankfurt", "Berlin"], ["Frankfurt", "Zurich"], ["Frankfurt", "Vienna"],
    ["Amsterdam", "London"], ["London", "Paris"], ["Paris", "Milan"], ["Zurich", "Milan"], ["Berlin", "Vienna"],
    ["Amsterdam", "Berlin"], ["Milan", "Vienna"], ["London", "New York"], ["Amsterdam", "Stockholm"], ["Paris", "Madrid"], ["Berlin", "Warsaw"],
  ];
  const all: Record<string, [number, number]> = Object.fromEntries([...cities, ...far].map(([n, lon, lat]) => [n, p(lon as number, lat as number)]));
  const arc = ([a, b]: string[]) => {
    const [x1, y1] = all[a], [x2, y2] = all[b];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18;
    return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}"/>`;
  };
  let dots = "";
  for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) dots += `M${x} ${y}h0.01`;
  const city = ([n]: (string | number)[]) => {
    const [x, y] = all[n];
    return `<circle cx="${x}" cy="${y}" r="9" fill="oklch(0.75 0.13 230 / 0.12)"/><circle cx="${x}" cy="${y}" r="3.2" fill="oklch(0.86 0.1 220)"/>
      <text x="${x + 10}" y="${y - 8}">${String(n).toUpperCase()}</text>`;
  };
  const farCity = ([n]: (string | number)[]) => { const [x, y] = all[n]; return `<circle cx="${x}" cy="${y}" r="2.2" fill="oklch(0.7 0.06 240 / 0.6)"/>`; };
  return `<svg class="wallpaper" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="wp" cx="55%" cy="45%" r="75%"><stop offset="0" stop-color="oklch(0.34 0.07 255)"/><stop offset="0.6" stop-color="oklch(0.24 0.06 262)"/><stop offset="1" stop-color="oklch(0.16 0.04 270)"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#wp)"/>
    <path d="${dots}" stroke="oklch(0.8 0.05 240 / 0.12)" stroke-width="2" stroke-linecap="round"/>
    <g fill="none" stroke="oklch(0.8 0.11 220 / 0.32)" stroke-width="1.2">${links.map(arc).join("")}</g>
    <g>${far.map(farCity).join("")}</g>
    <g font-family="JetBrains Mono, monospace" font-size="10" letter-spacing="0.08em" fill="oklch(0.85 0.05 230 / 0.55)">${cities.map(city).join("")}</g>
  </svg>`;
}
