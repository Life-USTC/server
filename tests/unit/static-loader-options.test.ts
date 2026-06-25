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

  it("keeps the short help flag behavior", () => {
    expect(parseStaticLoaderOptions(["-h"]).help).toBe(true);
  });

  it("resolves the snapshot sqlite path under the target directory", () => {
    expect(staticSnapshotPath("/tmp/static")).toBe(
      "/tmp/static/life-ustc-static.sqlite",
    );
  });
});
