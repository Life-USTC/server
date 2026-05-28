import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import "dotenv/config";
import { parseCliInteger, parseCliIntegerList } from "../util/cli-numbers";
import {
  buildPlaywrightServerEnv,
  resolvePlaywrightServerRuntime,
} from "../util/playwright-runtime";

type BenchmarkRun = {
  workers: number;
  repeat: number;
  durationMs: number;
  status: number | null;
  signal: NodeJS.Signals | null;
  passed: boolean;
};

type BenchmarkResult = {
  createdAt: string;
  baseUrl: string;
  matrix: number[];
  repeat: number;
  warmup: number;
  selectedWorkers: number | null;
  runs: BenchmarkRun[];
};

const DEFAULT_WORKERS = [1, 2, 4, 8, 12, 16, 20, 24, 32];
const DEFAULT_REPEAT = 2;
const DEFAULT_WARMUP = 1;
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    workers: number[];
    repeat: number;
    warmup: number;
    output: string;
    extraPlaywrightArgs: string[];
    skipBuild: boolean;
    reuseExistingServer: boolean;
  } = {
    workers: DEFAULT_WORKERS,
    repeat: DEFAULT_REPEAT,
    warmup: DEFAULT_WARMUP,
    output: "test-results/e2e-worker-benchmark.json",
    extraPlaywrightArgs: [],
    skipBuild: false,
    reuseExistingServer: false,
  };

  for (const arg of args) {
    if (arg === "--skip-build") {
      options.skipBuild = true;
    } else if (arg === "--reuse-existing-server") {
      options.reuseExistingServer = true;
    } else if (arg.startsWith("--workers=")) {
      options.workers = parseCliIntegerList(arg.slice("--workers=".length), {
        min: 1,
      });
    } else if (arg.startsWith("--repeat=")) {
      options.repeat = parseCliInteger(
        arg.slice("--repeat=".length),
        DEFAULT_REPEAT,
        { min: 1 },
      );
    } else if (arg.startsWith("--warmup=")) {
      options.warmup = parseCliInteger(
        arg.slice("--warmup=".length),
        DEFAULT_WARMUP,
        { min: 0 },
      );
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else {
      options.extraPlaywrightArgs.push(arg);
    }
  }

  if (options.workers.length === 0) {
    throw new Error("At least one positive worker count is required.");
  }
  return options;
}

function benchmarkEnv(workers?: number) {
  const { host, port, baseUrl } = resolvePlaywrightServerRuntime(process.env);
  return {
    ...buildPlaywrightServerEnv({
      host,
      port,
      baseUrl,
      env: process.env,
    }),
    PLAYWRIGHT_HOST: host,
    PLAYWRIGHT_PORT: port,
    PLAYWRIGHT_REUSE_SERVER: "1",
    ...(workers ? { PLAYWRIGHT_WORKERS: String(workers) } : {}),
  };
}

function runRequired(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: benchmarkEnv(),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

async function isServerReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

const SERVER_POLL_INTERVAL_MS = 500;

async function waitForServer(timeoutMs = 120_000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (await isServerReady()) {
      return;
    }
    await new Promise((resolveWait) =>
      setTimeout(resolveWait, SERVER_POLL_INTERVAL_MS),
    );
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function startServer() {
  const child = spawn(
    "bunx",
    ["next", "start", "--hostname", host, "--port", port],
    {
      cwd: repoRoot,
      env: benchmarkEnv(),
      stdio: ["ignore", "ignore", "inherit"],
    },
  );

  child.on("exit", (code, signal) => {
    if (!serverStopping) {
      console.error(
        `[e2e-benchmark] next start exited early with code=${code} signal=${signal}`,
      );
    }
  });

  return child;
}

function stopServer(child: ChildProcess | null) {
  if (!child || child.killed) return;
  serverStopping = true;
  child.kill("SIGTERM");
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function selectWorkers(runs: BenchmarkRun[]) {
  const successful = new Map<number, number[]>();
  for (const run of runs) {
    if (!run.passed) continue;
    const durations = successful.get(run.workers) ?? [];
    durations.push(run.durationMs);
    successful.set(run.workers, durations);
  }

  const candidates = [...successful.entries()]
    .filter(([, durations]) => durations.length >= options.repeat)
    .map(([workers, durations]) => ({
      workers,
      medianMs: median(durations),
    }))
    .sort((a, b) => a.medianMs - b.medianMs);

  if (candidates.length === 0) return null;

  const fastest = candidates[0];
  const withinFivePercent = candidates
    .filter((candidate) => candidate.medianMs <= fastest.medianMs * 1.05)
    .sort((a, b) => a.workers - b.workers);
  return withinFivePercent[0]?.workers ?? fastest.workers;
}

function runPlaywright(workers: number, repeat: number): BenchmarkRun {
  console.log(`[e2e-benchmark] workers=${workers} repeat=${repeat} started`);
  const startedAt = performance.now();
  const result = spawnSync(
    "bunx",
    [
      "playwright",
      "test",
      "--reporter=list",
      `--workers=${workers}`,
      ...options.extraPlaywrightArgs,
    ],
    {
      cwd: repoRoot,
      env: benchmarkEnv(workers),
      stdio: "inherit",
    },
  );
  const durationMs = Math.round(performance.now() - startedAt);
  const passed = result.status === 0;
  console.log(
    `[e2e-benchmark] workers=${workers} repeat=${repeat} ${passed ? "passed" : "failed"} in ${Math.round(durationMs / 1000)}s`,
  );
  return {
    workers,
    repeat,
    durationMs,
    status: result.status,
    signal: result.signal,
    passed,
  };
}

const options = parseArgs();
const repoRoot = process.cwd();
const { host, port, baseUrl } = resolvePlaywrightServerRuntime(process.env);
let serverStopping = false;
let server: ChildProcess | null = null;

if (!options.reuseExistingServer) {
  if (!options.skipBuild) {
    runRequired("bun", ["run", "build"]);
  }
  server = startServer();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopServer(server);
    process.exit(130);
  });
}

try {
  await waitForServer();

  for (let index = 1; index <= options.warmup; index += 1) {
    runPlaywright(options.workers[0], -index);
  }

  const runs: BenchmarkRun[] = [];
  for (const workers of options.workers) {
    for (let repeat = 1; repeat <= options.repeat; repeat += 1) {
      runs.push(runPlaywright(workers, repeat));
    }
  }

  const result: BenchmarkResult = {
    createdAt: new Date().toISOString(),
    baseUrl,
    matrix: options.workers,
    repeat: options.repeat,
    warmup: options.warmup,
    selectedWorkers: selectWorkers(runs),
    runs,
  };

  const outputPath = resolve(repoRoot, options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log(
    `[e2e-benchmark] selected workers: ${result.selectedWorkers ?? "none"}`,
  );
  console.log(`[e2e-benchmark] wrote ${options.output}`);

  if (runs.some((run) => !run.passed)) {
    process.exitCode = 1;
  }
} finally {
  stopServer(server);
}
