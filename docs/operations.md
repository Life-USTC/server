# Operations

Production and auth-runtime notes for the Life@USTC server. Local quick start
stays in [README.md](../README.md).

## Auth Record Cleanup

An independent workflow runs every 6 hours (also manual). It deletes up to 1000
expired Session, VerificationToken, OAuth access/refresh token, and DeviceCode
rows per table. It does not run migrations or static imports. Unexpired revoked
refresh tokens are kept until expiry for replay detection.

## Runtime database connections

App and auth connections are separate.

- Node production: both `DATABASE_URL` and `AUTH_DATABASE_URL`
- Cloudflare Worker: both `HYPERDRIVE` and `HYPERDRIVE_AUTH`

The auth connection carries session, token, OAuth, and Better Auth writes. Use a
least-privilege role and disable Hyperdrive query cache so revocations apply on
the next request. Production does not fall back to the app connection; missing
auth config fails startup. Local/dev may point both URLs at one database.

## App runtime role preflight

Before/after production role switches, verify identity, schema/table/column/
sequence/function privileges, public/default grants, RLS, ownership, and
default-deny without user context:

```bash
psql "$APP_RUNTIME_DATABASE_URL" -X \
  -v expected_role=app_runtime \
  -v expected_schema_privileges="$APP_RUNTIME_SCHEMA_PRIVILEGES" \
  -v expected_table_privileges="$APP_RUNTIME_TABLE_PRIVILEGES" \
  -v expected_column_privileges="$APP_RUNTIME_COLUMN_PRIVILEGES" \
  -v expected_sequence_privileges="$APP_RUNTIME_SEQUENCE_PRIVILEGES" \
  -v expected_function_privileges="$APP_RUNTIME_FUNCTION_PRIVILEGES" \
  -f prisma/roles/verify-app-runtime.sql
```

Privilege variables are comma-separated `Object:PRIVILEGE` lists sorted for
stable diffs. Output is boolean contract only (no business rows).

## Workers Builds

- Build: `bun install --frozen-lockfile && bun run app:prepare && bun run build`
- Deploy: `npx wrangler deploy`
- Non-production: `npx wrangler versions upload`
- Build variables: `SKIP_DEPENDENCY_INSTALL=true`, `BUN_VERSION` matching `.bun-version`
- Config source: `wrangler.jsonc`; secrets in Cloudflare Dashboard
- Public `workers.dev` / version / alias preview URLs are off in production;
  non-production still uploads versions for checks without public preview URLs
- Worker entry `src/worker.js` splits anonymous SSR vs private dynamic SSR;
  adapter internals come from `wrangler.adapter.jsonc` — see
  [rendering-and-cache.md](./rendering-and-cache.md)
