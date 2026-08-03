# tests/unit/helpers/

Shared notes for unit-test mocks. Each test file still owns top-level `vi.hoisted()`
and `vi.mock()` blocks — Vitest hoisting prevents importing mock factories inside
hoisted callbacks.

## Deferred promises

Use `createDeferred<T>()` from `tests/shared/deferred.ts` for overlap/concurrency
tests (import outside hoisted blocks).

## Hoisted mock templates

Copy into `vi.hoisted()` when wiring Prisma or Cloudflare trace mocks:

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
