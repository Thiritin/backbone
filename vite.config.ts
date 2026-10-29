import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

// The build id the page carries and the version.json it polls to offer a reload when a newer build is deployed.
const buildId = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
})();

const versionFile = (): Plugin => ({
  name: "version-file",
  apply: "build",
  closeBundle() {
    writeFileSync(join("dist", "version.json"), JSON.stringify({ build: buildId }));
  },
});

export default defineConfig({
  base: "./",
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), versionFile()],
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
});
