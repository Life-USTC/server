# src/lib/mcp/

MCP server and tools under `tools/{workspace,catalog,community,bus,uploads,graphql,_shared}/`.
Tool **names**/schemas stay stable across folder moves.

## Pattern

Thin adapter: Zod parse → `getUserId(authInfo)` → `src/features/*/server` →
`jsonToolResult(result, { mode })`. Do not write business logic or call Prisma
directly from tools.

```typescript
const input = inputSchema.parse(args);
const mode = resolveMcpMode(input.mode);
const userId = getUserId(authInfo);
const result = await featureUseCase(userId, input);
return jsonToolResult(result, { mode });
```

## Mode / Auth / Permissions

- **default**: compact canonical shape; **summary** is a deprecated alias;
  **full** adds nested fields without changing top-level structure
- Bearer only; audience `/api/mcp`
- Personal tools scope to `getUserId`; check suspension for collaborative writes;
  normal users do not mutate JW/import facts

Coverage: `$life-ustc-feature` + root `AGENTS.md` Commands. Architecture: root
`AGENTS.md`.
