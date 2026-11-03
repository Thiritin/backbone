import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { parseChangelog } from "./src/ui/changelog";

// The build id the page carries and the version.json it polls to offer a reload when a newer build is deployed.
const buildId = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || String(Date.now());
  } catch {
    return String(Date.now());
  }
})();
const changelog = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));

const versionFile = (): Plugin => ({
  name: "version-file",
  apply: "build",
  closeBundle() {
    writeFileSync(join("dist", "version.json"), JSON.stringify({ build: buildId, changelog }));
  },
});

// Test files share module scope for speed; files that mock modules or use the UI store singleton get a fresh one.
const testFiles = readdirSync("tests").filter((f) => /\.test\.tsx?$/.test(f)).map((f) => `tests/${f}`);
const isolated = testFiles.filter((f) => /vi\.(mock|doMock|resetModules|stubGlobal)\(|ui\/store"/.test(readFileSync(f, "utf8")));

export default defineConfig({
  base: "./",
  define: { __BUILD_ID__: JSON.stringify(buildId), __CHANGELOG__: JSON.stringify(changelog) },
  plugins: [react(), versionFile()],
  test: {
    environment: "node",
    testTimeout: 20000,
    projects: [
      { extends: true, test: { name: "shared", include: testFiles, exclude: isolated, isolate: false } },
      { extends: true, test: { name: "isolated", include: isolated } },
    ],
  },
});
