// Code-drawn pictures for the company website, tinted with the brand colour through --brand.
const BRAND = "var(--brand)";
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// A rack cabinet full of servers with blinking status lights.
export function RackArt() {
  return (
    <svg className="site-art" viewBox="0 0 320 300" role="img" aria-label="Server rack">
      <ellipse cx="160" cy="288" rx="130" ry="10" fill="#00000026" />
      <rect x="70" y="10" width="180" height="276" rx="8" fill="#1b2433" />
      <rect x="82" y="22" width="156" height="252" rx="3" fill="#0d131d" />
      {range(11).map((i) => (
        <g key={i} transform={`translate(88 ${28 + i * 22})`}>
          <rect width="144" height="18" rx="2" fill={i % 4 === 1 ? "#2a3446" : "#3a4558"} />
          {range(i % 4 === 1 ? 10 : 6).map((j) => <rect key={j} x={8 + j * (i % 4 === 1 ? 9 : 10)} y="5" width="5" height="8" rx="1" fill="#1b2433" />)}
          <circle cx="120" cy="9" r="2.5" fill="#3ddc84" className={`site-led d${(i * 3) % 5}`} />
          <circle cx="130" cy="9" r="2.5" fill={i === 6 ? "#ffb020" : BRAND} className={`site-led d${(i * 7) % 5}`} />
        </g>
      ))}
      <rect x="70" y="10" width="180" height="10" rx="4" fill={BRAND} />
    </svg>
  );
}

// A datacenter aisle in perspective, rows of racks on both sides and lights down the ceiling.
export function AisleArt() {
  // Rack row i spans depth d(i) to d(i + 1); depth 1 is the picture edge, 0 the vanishing point at (200, 120).
  const d = (i: number) => 1 - i / 7, x = (k: number, side: number) => 200 + side * (50 + 150 * k), top = (k: number) => 120 - 110 * k, bot = (k: number) => 120 + 140 * k;
  return (
    <svg className="site-art site-photo" viewBox="0 0 400 260" role="img" aria-label="Datacenter aisle" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="260" fill="#0b1120" />
      <polygon points="150,120 250,120 400,260 0,260" fill="#1f2a3f" />
      {range(7).map((i) => <line key={i} x1={x(d(i), -1)} y1={bot(d(i))} x2={x(d(i), 1)} y2={bot(d(i))} stroke="#2c3a55" />)}
      <polygon points="150,120 250,120 400,0 0,0" fill="#121a2b" />
      {range(6).map((i) => <rect key={i} x={194 - 30 * d(i)} y={top(d(i)) + 4} width={12 + 60 * d(i)} height={1 + 3 * d(i)} fill="#e8f0ff" opacity={0.9 - i * 0.1} />)}
      {range(6).flatMap((i) => [-1, 1].map((side) => {
        const a = d(i), b = d(i + 1);
        return (
          <g key={`${i}${side}`}>
            <polygon points={`${x(a, side)},${top(a)} ${x(b, side)},${top(b)} ${x(b, side)},${bot(b)} ${x(a, side)},${bot(a)}`} fill={i % 2 ? "#2b3954" : "#34435f"} stroke="#0b1120" strokeWidth="1.5" />
            {range(6).map((j) => (
              <circle key={j} cx={x(a, side) + (x(b, side) - x(a, side)) * (0.25 + (j % 2) * 0.4)} cy={top(a) + (bot(a) - top(a)) * (0.12 + j * 0.13)} r={2.4 * a + 0.5}
                fill={(i + j) % 3 ? BRAND : "#3ddc84"} className={`site-led d${(i + j + (side > 0 ? 2 : 0)) % 5}`} />
            ))}
          </g>
        );
      }))}
      <rect width="400" height="260" fill="url(#site-glow)" />
      <defs>
        <radialGradient id="site-glow" cx="50%" cy="45%" r="65%"><stop offset="0" stopColor="#ffffff" stopOpacity="0.1" /><stop offset="1" stopColor="#000000" stopOpacity="0.3" /></radialGradient>
      </defs>
    </svg>
  );
}

// A support desk: a monitor with an open ticket, a headset and a mug.
export function DeskArt() {
  return (
    <svg className="site-art site-photo" viewBox="0 0 400 260" role="img" aria-label="Support desk" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="260" fill="#e9eef7" />
      <rect x="0" y="0" width="400" height="190" fill="#f3f6fc" />
      <rect x="290" y="30" width="80" height="100" rx="4" fill="#ffffff" stroke="#d5dceb" />
      <rect x="300" y="42" width="60" height="40" fill={BRAND} opacity="0.25" />
      <rect x="0" y="190" width="400" height="70" fill="#c9a77c" />
      <rect x="0" y="190" width="400" height="6" fill="#b08d63" />
      <rect x="110" y="40" width="180" height="120" rx="8" fill="#1b2433" />
      <rect x="118" y="48" width="164" height="104" rx="3" fill="#ffffff" />
      <rect x="118" y="48" width="164" height="14" fill={BRAND} />
      {[70, 82, 94, 112, 124].map((y, i) => <rect key={y} x="128" y={y} width={[120, 96, 132, 108, 70][i]} height="5" rx="2" fill={i > 2 ? "#cfe0d4" : "#d5dceb"} />)}
      <rect x="236" y="134" width="38" height="12" rx="6" fill={BRAND} />
      <rect x="190" y="160" width="20" height="24" fill="#2a3446" />
      <rect x="160" y="182" width="80" height="8" rx="3" fill="#2a3446" />
      <path d="M58 172 a26 26 0 0 1 52 0" fill="none" stroke="#2a3446" strokeWidth="6" />
      <rect x="50" y="166" width="14" height="22" rx="5" fill="#2a3446" />
      <rect x="104" y="166" width="14" height="22" rx="5" fill="#2a3446" />
      <rect x="316" y="160" width="30" height="34" rx="4" fill={BRAND} />
      <path d="M346 168 h8 a8 8 0 0 1 0 16 h-8" fill="none" stroke={BRAND} strokeWidth="4" />
      <path d="M326 152 q4 -8 0 -14 M336 152 q4 -8 0 -14" stroke="#b8c2d6" strokeWidth="2" fill="none" />
    </svg>
  );
}
