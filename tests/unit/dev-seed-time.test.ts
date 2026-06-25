import { afterEach, describe, expect, it, vi } from "vitest";

async function importSeedTimeWithTimezone(timezone: string) {
  vi.stubEnv("TZ", timezone);
  vi.resetModules();
  return import("@tools/dev/seed/dev-seed-time");
}

describe("dev seed time helpers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it.each([
    "UTC",
    "America/New_York",
  ])("constructs Shanghai seed instants under %s host timezone", async (timezone) => {
    const { makeShanghaiSeedDateAt } =
      await importSeedTimeWithTimezone(timezone);

    expect(makeShanghaiSeedDateAt(0, 0).toISOString()).toBe(
      "2026-04-28T16:00:00.000Z",
    );
    expect(makeShanghaiSeedDateAt(8, 30, 1).toISOString()).toBe(
      "2026-04-30T00:30:00.000Z",
    );
    expect(makeShanghaiSeedDateAt(23, 59, -1).toISOString()).toBe(
      "2026-04-28T15:59:00.000Z",
    );
  });

  it.each([
    "UTC",
    "America/New_York",
  ])("constructs date-only seed values under %s host timezone", async (timezone) => {
    const { makeSeedDateOnly } = await importSeedTimeWithTimezone(timezone);

    expect(makeSeedDateOnly().toISOString()).toBe("2026-04-29T00:00:00.000Z");
    expect(makeSeedDateOnly(1).toISOString()).toBe("2026-04-30T00:00:00.000Z");
    expect(makeSeedDateOnly(-1).toISOString()).toBe("2026-04-28T00:00:00.000Z");
  });

  it("derives weekdays from Shanghai calendar days under a UTC host timezone", async () => {
    const { makeSeedDateOnly, makeShanghaiSeedDateAt, toShanghaiWeekday } =
      await importSeedTimeWithTimezone("UTC");

    expect(toShanghaiWeekday(makeShanghaiSeedDateAt(0, 0))).toBe(3);
    expect(toShanghaiWeekday(makeShanghaiSeedDateAt(23, 59, 4))).toBe(7);
    expect(toShanghaiWeekday(makeSeedDateOnly())).toBe(3);
  });
});
