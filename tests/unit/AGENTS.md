# tests/unit/

Unit tests for pure helpers.

## Run

Use the canonical command list in the repo root `AGENTS.md`; for this layer that
is `bunx vitest run tests/unit`.

## Scope

- Pure functions only
- No DB, browser, server, network
- Fast, deterministic

## Conventions

- Tests beside behavior area
- Table tests for edge cases
- Mock only process/env/time boundaries
- Don't import Prisma clients

## Coverage Priorities

- Date parsing/serialization
- API schemas and query builders
- Permission helpers (no session needed)
- Compact payload helpers

## Examples

```typescript
import { describe, test, expect } from "vitest";

describe("parseDateInput", () => {
  test.each([
    ["2026-05-06", new Date("2026-05-06T00:00:00.000Z")],
    ["invalid", null],
  ])("parseDateInput(%s) = %s", (input, expected) => {
    expect(parseDateInput(input)).toEqual(expected);
  });
});
```

## Deterministic Tests

- No `Date.now()` (mock if needed)
- No `Math.random()`
- No network calls
- No file system (except fixtures)
