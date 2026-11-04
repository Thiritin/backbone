import { afterEach } from "vitest";

// Unmount rendered trees after each test so React scheduler work cannot fire once jsdom is gone.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
