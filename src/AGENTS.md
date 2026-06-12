# src/

Source code organization.

## Structure

```
routes/       SvelteKit pages and endpoint handlers
features/     Business domain logic
lib/          Infrastructure
  mcp/        MCP server
i18n/         Locale config
shared/       Pure utilities
generated/    DO NOT EDIT (Prisma, OpenAPI)
```

## Imports

```typescript
// Use @ aliases
import { prisma } from "@/lib/db/prisma";
import type { User } from "@/generated/prisma/client";

// Relative for same folder
import { helper } from "./helper";
```

## Locales

- `zh-cn` (default), `en-us`
- No locale in URLs
- All user text needs both message files

See root `AGENTS.md` for auth, dates, Prisma, error patterns.
