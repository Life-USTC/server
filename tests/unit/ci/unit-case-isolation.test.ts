import { expect, it, vi } from "vitest";

const originalEnv = process.env.LIFE_USTC_UNIT_ISOLATION_PROBE;
const originalGlobal = Object.getOwnPropertyDescriptor(
  globalThis,
  "__lifeUstcUnitIsolationProbe",
);

// Every case can run alone or in any order. A preceding case deliberately
// leaves stubs installed so this checks the runner's case boundary itself.
it.each([1, 2, 3])(
  "restores environment, globals and spies before case %s",
  () => {
    expect(process.env.LIFE_USTC_UNIT_ISOLATION_PROBE).toBe(originalEnv);
    expect(
      Object.getOwnPropertyDescriptor(
        globalThis,
        "__lifeUstcUnitIsolationProbe",
      ),
    ).toEqual(originalGlobal);
    expect(vi.isMockFunction(Math.random)).toBe(false);

    vi.stubEnv("LIFE_USTC_UNIT_ISOLATION_PROBE", "changed");
    vi.stubGlobal("__lifeUstcUnitIsolationProbe", { changed: true });
    vi.spyOn(Math, "random").mockReturnValue(0.125);
  },
);
