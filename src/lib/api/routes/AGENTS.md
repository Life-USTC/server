# src/lib/api/routes/

HTTP adapters for SvelteKit API endpoints. May import feature server code;
keep transport-only logic here. Do not import these adapters from features or
generic `src/lib`. Boundary ratchet: `tests/unit/feature-boundaries.test.ts`.

See `src/lib/AGENTS.md`.
