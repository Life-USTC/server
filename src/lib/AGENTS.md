# src/lib/

Infrastructure and shared helpers. No business rules (`src/features/` owns those).

## Rules

- `src/lib/api/routes` may import feature server code as HTTP adapters (parse →
  call feature → serialize). Don't import those adapters from features, page
  actions, or generic `src/lib` helpers; keep `src/routes/api/**/+server.ts` thin.
- `src/lib/api/schemas` may import feature-owned constants/helpers for OpenAPI
  shapes only.
- Features import Cloudflare runtime and env through `src/lib/ports/`
  (`runtime.ts`, `env.ts`), not `src/lib/adapters/` directly.
- Pagination for domain code: `@/lib/pagination`. REST may keep using
  `@/lib/api/helpers` (re-exports).
- If adapter imports from `@/features` grow, update the matching boundary tests
  under `tests/unit/*-boundary.test.ts` (dashboard / settings / auth-prisma).
- No raw `@prisma/client` outside approved adapters/scripts.
- Never log OAuth tokens/secrets.

## Common imports

```typescript
import {
  buildPaginatedResponse,
  normalizePagination,
} from "@/lib/pagination";
import {
  handleRouteError,
  jsonResponse,
} from "@/lib/api/helpers";
import {
  requireAuth,
  requireWriteAuth,
  resolveSessionUserId,
} from "@/lib/auth/api-auth";
import { prisma, getPrisma } from "@/lib/db/prisma";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";
import { parseDateInput } from "@/lib/time/parse-date-input";
```

`requireAuth` callers must declare the accepted OAuth feature/action scope.
Optional personalization must use `resolveSessionUserId`; it never accepts a
Bearer token.

More detail: `components/`, `graphql/`, `mcp/`.
