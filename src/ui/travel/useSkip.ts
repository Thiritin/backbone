import { useEffect, useRef } from "react";

// Any key or click calls fn once.
export function useSkip(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let done = false;
    const go = (e: Event) => { e.preventDefault(); e.stopPropagation(); if (!done) { done = true; ref.current(); } };
    window.addEventListener("keydown", go, true);
    window.addEventListener("pointerdown", go, true);
    return () => { window.removeEventListener("keydown", go, true); window.removeEventListener("pointerdown", go, true); };
  }, []);
}
