import { parseArgs } from "node:util";

export const DEFAULT_STATIC_LOADER_CACHE_DIR = "./.cache/life-ustc/static";
export const DEFAULT_STATIC_LOADER_MIN_SEMESTER = "401";

export type StaticLoaderOptions = {
  cacheDir: string;
  minSemesterJwId: number;
  skipCourses: boolean;
  skipBus: boolean;
  help: boolean;
};

export function staticLoaderUsage() {
  return `Usage: bun run load:static -- [options]

Options:
  --cache-dir <path>      Snapshot download cache directory (default: .cache/life-ustc/static)
  --min-semester <id>     Minimum semester jwId to import (default: 401)
  --skip-courses          Skip course/exam/schedule import
  --skip-bus              Skip bus data import
  -h, --help              Show this help message`;
}

export function parseStaticLoaderOptions(
  argv = process.argv.slice(2),
): StaticLoaderOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      "cache-dir": {
        type: "string",
        default: DEFAULT_STATIC_LOADER_CACHE_DIR,
      },
      "min-semester": {
        type: "string",
        default: DEFAULT_STATIC_LOADER_MIN_SEMESTER,
      },
      "skip-courses": { type: "boolean", default: false },
      "skip-bus": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  return {
    cacheDir: values["cache-dir"] ?? DEFAULT_STATIC_LOADER_CACHE_DIR,
    minSemesterJwId: Number.parseInt(
      values["min-semester"] ?? DEFAULT_STATIC_LOADER_MIN_SEMESTER,
      10,
    ),
    skipCourses: values["skip-courses"] ?? false,
    skipBus: values["skip-bus"] ?? false,
    help: values.help ?? false,
  };
}
