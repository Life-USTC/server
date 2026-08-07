# src/lib/

Infrastructure and shared helpers. No business rules (`src/features/` owns those).

## Rules

- `src/lib/api/routes` may import feature server code as HTTP adapters (parse →
  call feature → serialize). Don't import those adapters from features, page
  actions, or generic `src/lib` helpers; keep `src/routes/api/**/+server.ts` thin.
- `src/lib/api/schemas` may import feature-owned constants/helpers for OpenAPI
  shapes only.
- If adapter imports from `@/features` grow, update the matching boundary tests
  under `tests/unit/*-boundary.test.ts` (dashboard / settings / auth-prisma).
- No raw `@prisma/client` outside approved adapters/scripts.
- Never log OAuth tokens/secrets.

## Common imports

```typescript
import {
  buildPaginatedResponse,
  handleRouteError,
  jsonResponse,
} from "@/lib/api/helpers";
import { requireAuth, requireWriteAuth, resolveApiUserId } from "@/lib/auth/api-auth";
import { prisma, getPrisma } from "@/lib/db/prisma";
import { parseDateInput } from "@/lib/time/parse-date-input";
```

More detail: `components/`, `graphql/`, `mcp/`.
