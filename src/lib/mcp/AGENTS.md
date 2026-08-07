# src/lib/mcp/

MCP server and tools under `tools/{workspace,catalog,community,bus,uploads,graphql,_shared}/`.
Tool names and schemas stay stable across folder moves.

## Pattern

Thin adapter: Zod parse → `getUserId(authInfo)` → `src/features/*/server` →
`jsonToolResult(result, { mode })`. Don't write business logic or call Prisma
directly from tools.

```typescript
const input = inputSchema.parse(args);
const mode = resolveMcpMode(input.mode);
const userId = getUserId(authInfo);
const result = await featureUseCase(userId, input);
return jsonToolResult(result, { mode });
```

## Mode / auth / permissions

- **default**: compact shape; **summary** is a deprecated alias; **full** adds
  nested fields without changing top-level structure
- Bearer only; audience `/api/mcp`
- Personal tools scope to `getUserId`; check suspension for collaborative writes;
  normal users don't mutate JW / import facts

Wire new tools like other transports; see `$life-ustc-implement`.
