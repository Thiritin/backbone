// The game was called Backbone. Its stored keys are copied to their raid0 key once, before anything reads them;
// the marker keeps a save deleted later from coming back.
const DONE = "raid0.adopted";

export function adoptOldKeys(store: Storage) {
  if (store.getItem(DONE)) return;
  const old: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith("backbone.")) old.push(k);
  }
  for (const k of old) {
    const key = "raid0" + k.slice("backbone".length);
    if (store.getItem(key) === null) store.setItem(key, store.getItem(k)!);
  }
  store.setItem(DONE, "1");
}

try {
  adoptOldKeys(localStorage);
  adoptOldKeys(sessionStorage);
} catch {
  // Storage blocked or missing; there is nothing to adopt.
}
