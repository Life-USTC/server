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

function parseMinSemesterJwId(value: string) {
  const minSemesterJwId = Number(value);

  if (
    !/^\+?\d+$/.test(value) ||
    !Number.isSafeInteger(minSemesterJwId) ||
    minSemesterJwId <= 0
  ) {
    throw new Error(
      `Invalid --min-semester "${value}": expected a positive safe integer jwId.`,
    );
  }

  return minSemesterJwId;
}

function normalizeMinSemesterArgs(argv: string[]) {
  const args: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextArg = argv[index + 1];

    if (arg === "--min-semester" && /^-\d/.test(nextArg ?? "")) {
      args.push(`--min-semester=${nextArg}`);
      index += 1;
      continue;
    }

    args.push(arg);
  }

  return args;
}

export function parseStaticLoaderOptions(
  argv = process.argv.slice(2),
): StaticLoaderOptions {
  const { values } = parseArgs({
    args: normalizeMinSemesterArgs(argv),
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

  const minSemesterValue =
    values["min-semester"] ?? DEFAULT_STATIC_LOADER_MIN_SEMESTER;

  return {
    cacheDir: values["cache-dir"] ?? DEFAULT_STATIC_LOADER_CACHE_DIR,
    minSemesterJwId: parseMinSemesterJwId(minSemesterValue),
    skipCourses: values["skip-courses"] ?? false,
    skipBus: values["skip-bus"] ?? false,
    help: values.help ?? false,
  };
}
