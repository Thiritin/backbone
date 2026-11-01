import { createContext, useCallback, useContext, useState } from "react";
import { useStore, type Store } from "../../store";

// The Browser's viewport shows a page's failed action on the page; outside it the error stays a notification.
export const PageError = createContext<((error: string | null) => void) | null>(null);

// act for web pages: the error lands on the page instead of a notification.
export function usePageAct(): Store["act"] {
  const act = useStore((s) => s.act), attempt = useStore((s) => s.attempt), report = useContext(PageError);
  return useCallback<Store["act"]>((fn, ...args) => {
    if (!report) return act(fn, ...args);
    const r = attempt(fn, ...args);
    report(r.ok ? null : r.error);
    return r;
  }, [act, attempt, report]);
}

// act for a form that shows the error next to its field.
export function useFieldAct(): [Store["act"], string | null] {
  const attempt = useStore((s) => s.attempt), [error, setError] = useState<string | null>(null);
  const run = useCallback<Store["act"]>((fn, ...args) => {
    const r = attempt(fn, ...args);
    setError(r.ok ? null : r.error);
    return r;
  }, [attempt]);
  return [run, error];
}
