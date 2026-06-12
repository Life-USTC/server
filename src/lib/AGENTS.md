# src/lib/

Infrastructure and shared helpers.

## Directories

```
api/       Request/response, schemas, status
auth/      Session resolution, permissions
db/        Prisma instances
mcp/       MCP server (see mcp/AGENTS.md)
oauth/     OAuth provider, tokens
storage/   S3 client, signed URLs
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
- No raw `@prisma/client` imports outside approved adapters/scripts
- Use shared helpers
- OAuth: never log tokens/secrets

See root `AGENTS.md` for patterns.
