import { describe, expect, it } from "vitest";
import { discordChunks, isReleaseTag, latestTag, nextTag, notesSince, previousTag } from "../scripts/release-lib.mjs";

const old = "# Changelog\n\n## 2026-11-03\n\n- Older change.\n\n## 2026-11-02\n\n- Oldest change.\n";
const now = "# Changelog\n\n## 2026-11-04\n\n- Newest change.\n\n## 2026-11-03\n\n- Added later.\n- Older change.\n\n## 2026-11-02\n\n- Oldest change.\n";

describe("release tags", () => {
  it("accepts only strict vX.Y.Z", () => {
    for (const ok of ["v0.0.0", "v1.0.0", "v10.20.30"]) expect(isReleaseTag(ok)).toBe(true);
    for (const bad of ["1.0.0", "v1.0", "v01.0.0", "v1.0.0-rc1", "v1.0.0.1", "2026.11.04", "v2026.11.04"]) expect(isReleaseTag(bad)).toBe(false);
  });

  it("finds the latest semver tag and ignores date tags", () => {
    expect(latestTag(["2026.11.04", "v1.9.0", "v1.10.0", "v1.2.0", "nightly"])).toBe("v1.10.0");
    expect(latestTag(["2026.11.04", "2026.10.31"])).toBeNull();
  });
});

describe("next version", () => {
  const tags = ["v0.5.0", "v1.4.2", "nightly"];

  it("bumps patch and minor", () => {
    expect(nextTag(tags, "patch")).toBe("v1.4.3");
    expect(nextTag(tags, "minor")).toBe("v1.5.0");
    expect(nextTag(tags, "1.4.9")).toBe("v1.4.9");
  });

  it("refuses a raised major without the approval flag", () => {
    expect(() => nextTag(tags, "major")).toThrow(/--user-approved-major/);
    expect(() => nextTag(tags, "2.0.0")).toThrow(/--user-approved-major/);
    expect(nextTag(tags, "major", true)).toBe("v2.0.0");
    expect(nextTag(tags, "2.1.0", true)).toBe("v2.1.0");
  });

  it("refuses versions that are not newer or not valid", () => {
    expect(() => nextTag(tags, "1.4.2")).toThrow(/not newer/);
    expect(() => nextTag(tags, "1.3.0")).toThrow(/not newer/);
    expect(() => nextTag(tags, "v1.5.0")).toThrow(/Bump must be/);
    expect(() => nextTag(tags, "huge")).toThrow(/Bump must be/);
  });

  it("accepts the explicit 1.0.0 without approval while the latest release is 0.x", () => {
    expect(nextTag(["v0.4.0", "v0.5.0"], "1.0.0")).toBe("v1.0.0");
    expect(() => nextTag(["v0.5.0"], "major")).toThrow(/--user-approved-major/);
    expect(() => nextTag(["v0.5.0"], "1.1.0")).toThrow(/--user-approved-major/);
    expect(() => nextTag(["v0.5.0"], "2.0.0")).toThrow(/--user-approved-major/);
    expect(() => nextTag(["v1.0.0"], "2.0.0")).toThrow(/--user-approved-major/);
  });

  it("walks 0.5.0 to 1.0.0 to 1.0.1", () => {
    const tags = ["v0.5.0"];
    tags.push(nextTag(tags, "1.0.0"));
    expect(tags.at(-1)).toBe("v1.0.0");
    expect(nextTag(tags, "patch")).toBe("v1.0.1");
  });

  it("starts from 0.0.0 when no release tag exists", () => {
    expect(nextTag(["2026.11.04"], "minor")).toBe("v0.1.0");
  });
});

describe("previous release", () => {
  const tags = ["v0.5.0", "v1.0.0", "v1.1.0", "v1.2.0", "nightly"];

  it("is the highest release below the new tag", () => {
    expect(previousTag(tags, "v1.2.0")).toBe("v1.1.0");
    expect(previousTag(tags, "v1.0.0")).toBe("v0.5.0");
    expect(previousTag(tags, "v1.0.1")).toBe("v1.0.0");
  });

  it("is null for the very first release", () => {
    expect(previousTag(["nightly"], "v0.1.0")).toBeNull();
  });
});

describe("release notes", () => {
  it("lists bullets added since the previous release newest first", () => {
    expect(notesSince(old, now)).toBe("- Newest change.\n- Added later.");
  });

  it("is empty when nothing was added and takes everything without a baseline", () => {
    expect(notesSince(now, now)).toBe("");
    expect(notesSince(null, old)).toBe("- Older change.\n- Oldest change.");
  });
});

describe("discord chunks", () => {
  it("heads the post with the version and splits below the limit on line breaks", () => {
    expect(discordChunks("v1.0.0", "- One.")[0]).toBe("# [1.0.0](https://raid0.dev)\n- One.");
    const chunks = discordChunks("v1.0.0", Array.from({ length: 30 }, (_, i) => `- Change number ${i}.`).join("\n"), 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
    expect(chunks.join("\n")).toContain("- Change number 29.");
  });
});
