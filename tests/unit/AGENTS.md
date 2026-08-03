# tests/unit/

Unit tests for pure helpers and read-model orchestration.

## Run

See `tests/AGENTS.md` for commands. Shared mock templates: `tests/unit/helpers/AGENTS.md`.

## Scope

- Pure functions and orchestration with mocked I/O boundaries
- No real DB, browser, server, or network
- Fast, deterministic

## Conventions

- Tests beside behavior area
- Table tests for edge cases
- Mock only process/env/time boundaries
- Prefer `tests/fixtures/dev-seed.ts` anchors over ad-hoc dates
- Don't import real Prisma clients

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
