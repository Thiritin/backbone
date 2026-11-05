const MONO = 'ui-monospace, Menlo, Monaco, Consolas, "DejaVu Sans Mono", monospace';
const FIT = { textLength: 313, lengthAdjust: "spacingAndGlyphs" as const };

// Flat copy of docs/brand/wordmark.svg without glow, gradients or backing tile.
export function Wordmark() {
  return (
    <svg viewBox="40 70 880 140" role="img" aria-label="raid0" xmlns="http://www.w3.org/2000/svg">
      <mask id="wm-stripes"><rect x="0" y="0" width="950" height="280" fill="#fff" /><rect x="510" y="112" width="80" height="6" fill="#000" /><rect x="510" y="139" width="80" height="6" fill="#000" /><rect x="510" y="166" width="80" height="6" fill="#000" /></mask>
      <polygon points="60,87 94,87 156,142 94,197 60,197 122,142" fill="#F2EEEA" />
      <text x="200" y="190" fontFamily={MONO} fontWeight={700} fontSize={130} fill="#F2EEEA" {...FIT}>raid</text>
      <path d="M550 88 a30 30 0 0 1 30 30 V166 a30 30 0 0 1 -60 0 V118 a30 30 0 0 1 30 -30 Z M550 108 a10 10 0 0 1 10 10 V166 a10 10 0 0 1 -20 0 V118 a10 10 0 0 1 10 -10 Z" fill="#D0342C" fillRule="evenodd" mask="url(#wm-stripes)" />
      <text x="588" y="190" fontFamily={MONO} fontWeight={700} fontSize={130} fill="#6B7280" {...FIT}>.dev</text>
    </svg>
  );
}
