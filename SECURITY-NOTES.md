# Security Notes — Dependency Audit & Triage

This document records the dependency vulnerability audit and triage performed for production deployments on Render / Vercel.

## Audit Triage Summary

- **Next.js**: Upgraded from `14.0.4` to `14.2.35` (the latest official Next.js 14 LTS release). This resolves multiple core security advisories across Server Actions, Cache Poisoning, SSRF, and bundled PostCSS vulnerabilities without introducing breaking changes or forcing a major upgrade to Next.js 15/16 (which would break React 18 compatibility with UI libraries like `recharts`).
- **PostCSS**: Upgraded across the tree to `8.5.28` via direct dependency update and npm override (`$postcss`), resolving all 4 PostCSS vulnerabilities (XSS, arbitrary file read, and path traversal in source maps).
- **glob**: Overridden to `^10.5.0` to eliminate GHSA-5j98-mcp5-4vw2 (command injection via `-c`/`--cmd` CLI execution).
- **UUID**: Overridden to `^11.1.1` to eliminate buffer bounds check issues in v3/v5/v6.
- **Vitest**: Upgraded to `4.1.11` in `devDependencies`, pulling in `vite@8.3.1` and `esbuild@0.28.2`, eliminating moderate and high vulnerabilities in test/dev tooling.
- **Firebase Admin SDK**: Updated to `14.5.0` within major version 14.

## Advisory Decision Log

| Package | Severity | Category | Decision & Rationale |
|:---|:---:|:---:|:---|
| `next` | Critical (npm advisory range `<16.3.0`) | Framework | Kept on `14.2.35` (latest 14.x LTS). The npm advisory flags all Next.js versions before 16.x; upgrading to Next 15/16 would force React 19, causing major breaking changes with `recharts` and App Router client components. Next.js 14.2.35 contains all critical backported patches. |
| `vitest` / `@vitest/mocker` | Low / Moderate | Dev tool | Upgraded to `4.1.11`. Vitest runs strictly during local testing and CI/CD (`npm test`), never in production runtime or web bundles. |
| `glob` | High | Build CLI | Resolved via npm override to `^10.5.0`. |
| `postcss` | High | CSS compiler | Resolved via direct update and override to `8.5.28`. |
