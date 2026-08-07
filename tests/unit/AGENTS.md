# tests/unit/

Pure helpers and mocked orchestration. No real DB, browser, server, or network.
Mock only process/env/time boundaries; prefer `tests/fixtures/dev-seed.ts`
anchors; never import real Prisma clients.

Hoisted mock templates: see `helpers/AGENTS.md`.

```typescript
import { describe, test, expect } from "vitest";

describe("parseDateInput", () => {
  test.each([
    ["2026-05-06", new Date("2026-05-06T00:00:00.000Z")],
    ["invalid", null],
  ])("parseDateInput(%s)", (input, expected) => {
    expect(parseDateInput(input)).toEqual(expected);
  });
});
```

Priorities: date helpers, API schemas, permission helpers, compact payloads.
Deterministic: no live `Date.now()` / `Math.random()` / network / FS (except fixtures).
