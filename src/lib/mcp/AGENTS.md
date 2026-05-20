# src/lib/mcp/

MCP server and tools.

## Structure

```
server.ts        MCP server registration
tools/           Tool implementations
  _helpers.ts    Shared utilities
  dashboard.ts
  homework.ts
  ...
```

## Tool Pattern

```typescript
import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

const inputSchema = z.object({
  sectionJwId: z.number().describe("Section JW ID"),
  mode: z.enum(["summary", "default", "full"]).optional(),
});

export async function myTool(args: unknown, authInfo?: AuthInfo) {
  const input = inputSchema.parse(args);
  const mode = resolveMcpMode(input.mode);
  const userId = getUserId(authInfo);

  const result = await doWork(userId, input);
  return jsonToolResult(result, { mode });
}
```

## Mode Guidance

- **summary**: Counts, top samples
- **default**: Standard agent calls
- **full**: Complete nested records

## Auth

- Bearer token required (no cookies)
- Audience must match `/api/mcp`
- User id is read from SDK `authInfo.extra.userId` through `getUserId(authInfo)`

## Tool Descriptions

```typescript
server.addTool({
  name: "my_tool",
  description: "When to use this tool (not exhaustive return shape)",
  inputSchema: zodToJsonSchema(inputSchema),
  handler: myTool,
});
```

## Patterns

```typescript
// Writes
await prisma.model.create({ data });

// Localized reads
const localPrisma = getPrisma(locale);
await localPrisma.model.findMany();

// Dates
import { flexDateInputSchema } from "@/lib/mcp/tools/_helpers";
import { parseDateInput } from "@/lib/time/parse-date-input";

// Output
return jsonToolResult(data, { mode }); // handles dates + compaction
```

## Permissions

- Personal tools scope to `getUserId(authInfo)`
- Check suspension for collaborative writes
- Normal users don't mutate JW/import facts

See root `AGENTS.md` for auth, dates, Prisma, errors.
