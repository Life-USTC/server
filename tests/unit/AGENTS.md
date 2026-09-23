# tests/unit/

Pure helpers and mocked orchestration. No real DB, browser, server, or network.
Mock only process/env/time boundaries; prefer `tests/fixtures/dev-seed.ts`
anchors; never import real Prisma clients.

## Hoisted mocks

Vitest hoisting means each test file owns top-level `vi.hoisted()` / `vi.mock()` —
don't import mock factories inside hoisted callbacks. Use
`createDeferred<T>()` from `tests/shared/deferred.ts` outside hoisted blocks.

```typescript
const { withUserDbContextMock, homeworkCountMock } = vi.hoisted(() => {
  const homeworkCount = vi.fn();
  const tx = { homework: { count: homeworkCount } };
  return {
    homeworkCountMock: homeworkCount,
    withUserDbContextMock: vi.fn(async (_userId, action) => action(tx)),
  };
});

const { runCloudflareTraceSpanMock } = vi.hoisted(() => ({
  runCloudflareTraceSpanMock: vi.fn((_name, _attrs, callback) => callback()),
}));
```

## Priorities

Date helpers, API schemas, permission helpers, compact payloads. Deterministic:
no live `Date.now()` / `Math.random()` / network / FS (except fixtures).
