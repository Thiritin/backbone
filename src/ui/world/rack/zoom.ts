export const ZOOM_MAX = 4;
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(1, z));
// A wheel notch scales the zoom; a trackpad pinch arrives as a ctrl wheel with smaller deltas.
export const wheelZoom = (z: number, e: { deltaY: number; ctrlKey?: boolean }) => clampZoom(z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
export const stepZoom = (z: number, dir: 1 | -1) => clampZoom(z * (dir > 0 ? 1.25 : 0.8));
// The tag's left offset from its scene, kept inside the visible stage on both sides; the scene sits at `base` in the scrolled content.
export const tagLeft = (want: number, base: number, scrollLeft: number, clientWidth: number, tagW: number, pad = 8) =>
  Math.max(scrollLeft + pad - base, Math.min(scrollLeft + clientWidth - pad - tagW - base, want));
