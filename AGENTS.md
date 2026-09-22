# AGENTS.md — Battery Vital Instructions for AI Coding Agents

Project: **Battery Vital** — Intelligent Battery Safety & Environmental Monitoring System.
Stack: Next.js 14 (App Router, `src/`), React 18, Firebase RTDB (live streaming), Firebase Admin SDK, MongoDB Atlas persistence, Gemini AI diagnostics, Tailwind CSS, Vitest, ESP32 firmware (`esp32/`).

Authoritative docs (read before touching related code): `RULES.md`, `SECURITY.md`, `ARCHITECTURE.md`, `DATABASE.md`, `ERROR_HANDLING.md`, `PERFORMANCE.md`, `VALIDATION.md`, `ESP32_RULES.md`, `PRD.md`, `API.md`. When in doubt, follow `RULES.md` and `SECURITY.md` first.

## Commands

- Dev server: `npm run dev`
- Lint: `npm run lint`
- Test (Vitest): `npm test`  (tests live beside code as `src/lib/*.test.js`; `server-only` is mocked via `src/__mocks__/server-only.js`)
- Verify before finishing: `npm run lint` **and** `npm test` **and** `npm run build`.

## Non-negotiable project invariants

1. **Deterministic safety engine is supreme.** `src/lib/batterySafety.js` is the final authority on system health. Gemini (`src/lib/gemini.js`) is an interpretive layer only and must **never** claim a lower risk than the engine. Rank: `SAFE(0) < CAUTION(1) < WARNING(2) < CRITICAL(3) < EMERGENCY(4)`.
2. **Hardware safety lockout.** Web commands via `/api/control/*` must not silence active `CRITICAL`/`EMERGENCY` trips (reject with 403/422). ESP32 firmware (`esp32/BatteryVital_v13.0/`) runs its safety loop independently of the network.
3. **RBAC.** Roles `ADMIN > OPERATOR > VIEWER`; permissions in `src/lib/permissions.js`. Every mutating route (`POST`/`PUT`/`DELETE`) must verify the user and check permissions (`src/lib/auth.js` + `src/lib/permissions.js`). Page-level auth is enforced via `src/middleware.js` (cookie-based session guard).
4. **Telemetry validation.** All incoming packets validate/clamp against the plausible ranges in `RULES.md` §2.1 (via `batterySafety.js`) before persistence or AI analysis.

## Critical decision rules (apply in order)

1. Need to exist? → If not, skip it (YAGNI). No dead endpoints, unused vars, or speculative abstraction.
2. Already in codebase? → reuse, don't rewrite (`src/lib/schemas.js`, `src/lib/rateLimit.js`, `src/lib/circuitBreaker.js`, `src/lib/retry.js`, `src/lib/errorHandler.js` already exist).
3. Stdlib / platform feature does it? → use it.
4. Installed dependency does it? → use it (zod, mongodb, firebase*, next, react, recharts, date-fns, `server-only`).
5. One line? → write one line.
6. Only then, write the minimum that works.

## Security rules (ALL mandatory — production-grade; see SECURITY.md)

1. **Secrets stay server-side.** NEVER expose `GEMINI_API_KEY`, `MONGODB_URI`, `FIREBASE_ADMIN_*`, JWT secrets, or any non-`NEXT_PUBLIC_` env var in client code or bundles. Only `NEXT_PUBLIC_*` vars may appear in browser code. No hardcoded secrets; reference `.env.example` only.
2. **Secure backend architecture.** All API requests pass through protected routes; add auth middleware and RBAC; validate/sanitize every incoming request (zod schemas in `src/lib/schemas.js`).
3. **Abuse & spam prevention.** Reuse the sliding-window rate limiter (`src/lib/rateLimit.js`) on all API endpoints (see SECURITY.md §6.1 for limits). Prevent unlimited per-IP/user requests; return 429 with `Retry-After` where specified.
4. **Database protection.** Use parameterized queries / ORM validation (MongoDB driver). Never run raw user queries. Validate schemas before storage. Least-privilege DB access.
5. **File/data upload constraints.** Restrict file types and sizes, block executables/scripts, sanitize user-generated content.
6. **Authentication & sessions.** Hash passwords with bcrypt/argon2; secure JWT/session handling (see `src/lib/auth.js`); token expiration + refresh; prevent session hijacking.
7. **Web vulnerability defense.** Prevent XSS, CSRF, SSRF, command injection, path traversal, unauthorized API access. Sanitize all user-supplied content before it reaches Gemini (prompt-injection hardening per `src/lib/gemini.js` and `RULES.md` §3).
8. **Logging & monitoring.** Use `console.warn`/`console.error` for errors/security alerts (`console.log` is stripped in production builds). Log suspicious/repeated-failed activity. Error handlers (`src/lib/errorHandler.js`, `src/lib/errors.js`) must never leak internal server details.
9. **Production deployment.** HTTPS only. Secrets in `.env`/secret managers, never committed. CORS configured per `next.config.js`/`vercel.json`. No debug mode in production.
10. **Code quality.** Scalable structure, modular/maintainable code, comment critical security logic, optimize performance and API efficiency.

## Style rules (always)

- **Use emojis instead of SVG icons** in UI components.
- **Do not change model strings** found in code (e.g., the Gemini model default `gemini-1.5-flash` in `src/lib/gemini.js` / `.env.example`).
- **Avoid gradients** in UI/CSS.

## Architecture conventions

- App Router: Server Components for static views/data fetching; Client Components (`'use client'`) only for interactive charts, forms, socket/listener components.
- Never import server-only modules (`mongodb.js`, `firebaseAdmin.js`, `gemini.js`, `auth.js`) into Client Components. All server-only modules use `import 'server-only'` as a defense-in-depth guard.
- Page-level authentication is enforced by `src/middleware.js` which checks for a `bv_session` cookie on page routes and a `Bearer` token on API routes.
- Follow existing folder structure (`src/app/api/**` per resource, `src/components/**` per feature, `src/lib/**` for one-purpose modules). Match the existing code style — no new comments unless they explain safety-critical logic.
- Reuse existing schemas, rate limiter, retry/circuit-breaker, and error helpers rather than reinventing them.
- All API routes must use `handleError(error, request)` in catch blocks for structured error responses with `requestId` tracking. Never return `error.message` directly.