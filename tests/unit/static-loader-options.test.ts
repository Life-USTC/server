import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATIC_LOADER_CACHE_DIR,
  parseStaticLoaderOptions,
} from "../../tools/load/static-loader-options";
import { staticSnapshotPath } from "../../tools/load/static-snapshot-source";

describe("static loader options", () => {
  it("uses the existing loader defaults", () => {
    expect(parseStaticLoaderOptions([])).toEqual({
      cacheDir: DEFAULT_STATIC_LOADER_CACHE_DIR,
      minSemesterJwId: 401,
      skipCourses: false,
      skipBus: false,
      help: false,
    });
  });

  it("parses explicit import flags", () => {
    expect(
      parseStaticLoaderOptions([
        "--cache-dir",
        "/tmp/static",
        "--min-semester",
        "2025",
        "--skip-courses",
        "--skip-bus",
      ]),
    ).toEqual({
      cacheDir: "/tmp/static",
      minSemesterJwId: 2025,
      skipCourses: true,
      skipBus: true,
      help: false,
    });
  });

  it.each([
    "1",
    "401",
    "2026",
  ])("parses valid --min-semester value %s", (value) => {
    expect(
      parseStaticLoaderOptions(["--min-semester", value]).minSemesterJwId,
    ).toBe(Number.parseInt(value, 10));
  });

  it.each([
    "foo",
    "NaN",
    "2026abc",
    "0",
    "-1",
    "1.5",
  ])("rejects invalid --min-semester value %s", (value) => {
    expect(() => parseStaticLoaderOptions(["--min-semester", value])).toThrow(
      `Invalid --min-semester "${value}": expected a positive safe integer jwId.`,
    );
  });

  it("rejects --min-semester values beyond Number.MAX_SAFE_INTEGER", () => {
    const unsafeValue = "9007199254740992";

    expect(() =>
      parseStaticLoaderOptions(["--min-semester", unsafeValue]),
    ).toThrow(
      `Invalid --min-semester "${unsafeValue}": expected a positive safe integer jwId.`,
    );
  });

  it("keeps the short help flag behavior", () => {
    expect(parseStaticLoaderOptions(["-h"]).help).toBe(true);
  });

  it("resolves the snapshot sqlite path under the target directory", () => {
    expect(staticSnapshotPath("/tmp/static")).toBe(
      "/tmp/static/life-ustc-static.sqlite",
    );
  });
});
