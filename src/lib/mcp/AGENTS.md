# src/lib/mcp/

MCP server and tools.

## Structure

```
server.ts              MCP server registration
tools/
  workspace/           overview, todos, subscriptions, schedules, exams, dashboard, calendar
  catalog/             course/section/teacher search, section match, section records
  community/           comments, descriptions, section homework mutations
  bus/                 departures, timetable, preferences
  uploads/             upload tools
  graphql/             graphql_operation_run
  _shared/             helpers, date parsing, cross-domain section helpers
```

Tool **names** and schemas stay stable across folder moves. Prefer move + import updates over renames.

## Tool Pattern

```typescript
import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";

const inputSchema = z.object({
  sectionJwId: z.number().describe("Section JW ID"),
  mode: mcpModeInputSchema.optional(),
});

export async function myTool(args: unknown, authInfo?: AuthInfo) {
  const input = inputSchema.parse(args);
  const mode = resolveMcpMode(input.mode);
  const userId = getUserId(authInfo);

  const result = await doWork(userId, input);
  return jsonToolResult(result, { mode });
}
```

## Adapter role

MCP handlers are thin adapters: parse auth/scope → call `src/features/*/server` use-cases → map transport shape (`jsonToolResult` + compact mode). MCP-only presentation (compact pickers, mode summary/full) stays here as a view layer, not business logic.

## Mode Guidance

- **default**: Canonical compact structure for standard agent calls
- **summary**: Deprecated compatibility alias for `default`; never changes array/object types
- **full**: Adds complete nested record fields while preserving the top-level structure

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
import { flexDateInputSchema } from "@/lib/mcp/tools/_shared/helpers";
import { parseDateInput } from "@/lib/time/parse-date-input";

// Output
return jsonToolResult(data, { mode }); // handles dates + compaction
```

## Permissions

- Personal tools scope to `getUserId(authInfo)`
- Check suspension for collaborative writes
- Normal users don't mutate JW/import facts

## Verification

For REST/MCP behavior changes, follow the API/MCP verification sequence in
`$life-ustc-dev-loop`.

See root `AGENTS.md` for auth, dates, Prisma, errors.
