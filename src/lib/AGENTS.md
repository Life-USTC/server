# src/lib/

Infrastructure and shared helpers.

## Directories

```
api/       Request/response, schemas, status
auth/      Session resolution, permissions
components/ Shared UI primitives and layout components
db/        Prisma instances
mcp/       MCP server (see mcp/AGENTS.md)
oauth/     OAuth provider, tokens
storage/   Cloudflare R2 object helpers
security/  CSP, content security
time/      Date parsing, serialization
log/       Structured logging
```

## Key Imports

```typescript
// API
import {
  buildPaginatedResponse,
  handleRouteError,
  jsonResponse,
} from "@/lib/api/helpers";

// Auth
import { requireAuth, requireWriteAuth, resolveApiUserId } from "@/lib/auth/api-auth";

// DB
import { prisma, getPrisma } from "@/lib/db/prisma";

// Time
import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
```

## Rules

- No business logic (use `src/features/`)
- `src/lib/api/routes` adapts HTTP to feature/server functions; do not call route handlers from features or page actions
- No raw `@prisma/client` imports outside approved adapters/scripts
- Use shared helpers
- OAuth: never log tokens/secrets

See root `AGENTS.md` for patterns.
