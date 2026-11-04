---
name: release
description: Cut a raid0 release (website, desktop installers, Discord post). Use when asked to release, ship, publish a version or cut v1.0.0 or later.
---

Follow docs/release.md. Choose only patch or minor, never major and never `--user-approved-major` unless the user explicitly asked for a major release in this conversation. Start with `npm run release -- <bump> --dry`.
