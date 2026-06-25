# src/lib/api/routes/

HTTP route adapters for SvelteKit API endpoints.

## Rules

- This directory is the intentional exception to the generic `src/lib` infrastructure boundary: adapters may import feature-owned server operations and narrow feature-owned helpers when adapting REST requests to feature behavior.
- Keep adapters transport-level: parse params/query/body, resolve auth or locale, call feature server functions, and shape HTTP success/error responses.
- Keep business rules and reusable read/write operations in `src/features/<feature>/server`; do not add domain services here.
- Do not import these adapters from features, page actions, or generic `src/lib` helpers. `src/routes/api/**/+server.ts` files may import them to keep SvelteKit route entries thin.
- If a change increases adapter imports from `@/features`, update the boundary ratchet in `tests/unit/feature-boundaries.test.ts` deliberately.

See `src/lib/AGENTS.md` and the root `AGENTS.md` for the broader source boundaries.
