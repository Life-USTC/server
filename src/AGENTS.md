# src/

```text
routes/       SvelteKit pages and handlers
features/     Domain use-cases (see features/AGENTS.md)
lib/          Infrastructure (ports/, adapters/, components/, mcp/, …)
i18n/         Locale config
shared/       Pure utilities
generated/    DO NOT EDIT
```

Domain code imports runtime only through `src/lib/ports/`; concrete `node:*` /
`bun:*` / `fs` / `process` usage stays in `src/lib/adapters/`.

```typescript
import { prisma } from "@/lib/db/prisma";
import type { User } from "@/generated/prisma/client";
import { helper } from "./helper"; // relative within folder
```

Locales: `zh-cn` (default), `en-us`; no URL prefix; both message files for user text.
See root `AGENTS.md` for auth, dates, Prisma, errors.
