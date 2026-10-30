export const isMobile = matchMedia("(hover: none) and (pointer: coarse)").matches;

export function MobileGate() {
  return (
    <div className="mobile-gate">
      <img src="favicon.svg" alt="" width={64} height={64} />
      <h1>Backbone is a desktop game</h1>
      <p>Backbone cannot be played on a phone or tablet. Open it on a computer to play.</p>
      <a href="https://discord.gg/e8nTAV8Yk7" target="_blank" rel="noopener">Join the Discord</a>
    </div>
  );
}
