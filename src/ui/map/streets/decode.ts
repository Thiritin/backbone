// Street lines packed as one string: polyline-encoded points at 1e-5 degrees, deltas running on across lines, lines split by spaces.
export function decode(s: string): [number, number][][] {
  let i = 0, lat = 0, lon = 0, enc = "";
  const next = () => {
    let r = 0, sh = 0, b;
    do { b = enc.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  return s.split(" ").map((part) => {
    const out: [number, number][] = [];
    enc = part; i = 0;
    while (i < enc.length) { lat += next(); lon += next(); out.push([lon / 1e5, lat / 1e5]); }
    return out;
  });
}
