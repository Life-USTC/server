import { type ChildProcess, fork } from "node:child_process";
import { watch } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test as base, expect } from "@playwright/test";

type Phase = "config" | "build" | "reload" | "disconnect";
type Outcome = {
  code: number | null;
  signal: NodeJS.Signals | null;
};
type NativeWorker = {
  exited: Promise<Outcome>;
  processGroup: number;
  temporaryDirectory: string;
  errors: string[];
  log: () => string;
  ready: () => boolean;
  disconnectedAtBundle: () => string | undefined;
};

function killOwnedGroup(child: ChildProcess) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

const test = base.extend<{ phase: Phase; nativeWorker: NativeWorker }>({
  phase: ["config", { option: true }],
  nativeWorker: async ({ phase }, use, testInfo) => {
    const directory = testInfo.outputPath("native-startup");
    const temporaryDirectory = join(directory, ".wrangler", "tmp");
    await mkdir(temporaryDirectory, { recursive: true });
    const config = join(directory, "wrangler.jsonc");
    const entrypoint = join(directory, "worker.mjs");
    await writeFile(
      config,
      JSON.stringify({
        name: "private-worker-startup-contract",
        main: "worker.mjs",
        compatibility_date: "2026-09-01",
      }),
    );
    await writeFile(
      entrypoint,
      phase === "build"
        ? 'import "./missing-dependency.mjs"; export default { fetch() { return new Response("unreachable"); } };'
        : phase === "reload"
          ? 'import { env } from "cloudflare:workers"; if (env.APP_PUBLIC_ORIGIN.startsWith("http:")) throw new Error("PRIVATE_WORKER_ORIGIN_RELOAD_FAILURE"); export default { fetch() { return new Response("initial"); } };'
          : 'export default { fetch() { return new Response("ready"); } };',
    );

    const child = fork(
      resolve("tests/ci/fixtures/isolated-worker-process.mjs"),
      {
        cwd: directory,
        env: { ...process.env, FUNCTION_OWNER_DATABASE_URL: undefined },
        execArgv: [],
        detached: true,
        silent: true,
      },
    );
    let output = "";
    let ready = false;
    let closed = false;
    let disconnectedAtBundle: string | undefined;
    let watcher: ReturnType<typeof watch> | undefined;
    const errors: string[] = [];
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => errors.push(String(error)));
    child.on("message", (message: { type?: string; message?: string }) => {
      if (message.type === "ready") ready = true;
      if (message.type === "error") errors.push(message.message ?? "");
    });
    const processExited = new Promise<Outcome>((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    // Parent-initiated IPC disconnect can omit ChildProcess's aggregate close
    // event. Observe the actual exit and every owned stdio stream separately.
    const streamsClosed = [child.stdin, child.stdout, child.stderr].map(
      (stream) =>
        new Promise<void>((resolve) => {
          if (!stream || stream.closed) resolve();
          else stream.once("close", () => resolve());
        }),
    );
    const exited = Promise.all([processExited, ...streamsClosed]).then(
      ([outcome]) => {
        closed = true;
        return outcome;
      },
    );

    try {
      if (!child.pid) throw new Error("Native Worker process was not created");
      await writeFile(
        join(directory, "native-worker-state.json"),
        JSON.stringify({ processGroup: child.pid, phase, temporaryDirectory }),
      );
      if (phase === "disconnect") {
        // Observe Wrangler's real initial build, then disconnect before ready.
        // A timer or a fabricated ready message would not prove this boundary.
        watcher = watch(temporaryDirectory, (_, filename) => {
          if (
            filename?.startsWith("dev-") &&
            !disconnectedAtBundle &&
            child.connected
          ) {
            disconnectedAtBundle = filename;
            child.disconnect();
          }
        });
      }
      child.send({
        type: "start",
        options: {
          config,
          entrypoint:
            phase === "config"
              ? join(directory, "missing-worker.mjs")
              : entrypoint,
          envFiles: [],
          bindings: {
            APP_PUBLIC_ORIGIN: { type: "plain_text", value: "unbound" },
          },
          dev: {
            remote: false,
            server: { hostname: "127.0.0.1", port: 0 },
            inspector: false,
            persist: false,
            watch: false,
            logLevel: "error",
            generateTypes: false,
          },
        },
      });
      await use({
        exited,
        processGroup: child.pid,
        temporaryDirectory,
        errors,
        log: () => output,
        ready: () => ready,
        disconnectedAtBundle: () => disconnectedAtBundle,
      });
    } finally {
      watcher?.close();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (!closed && child.connected) child.send({ type: "stop" });
        await Promise.race([
          exited,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Native Worker did not stop within 15s")),
              15_000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
        killOwnedGroup(child);
        await exited;
        await writeFile(join(directory, "isolated-worker.log"), output);
      }
    }
  },
});

const failures = {
  config: {
    message: "Error: An error occurred when starting the server",
    cause: 'The entry-point file at "',
    detail: "missing-worker.mjs",
  },
  build: {
    message:
      "Error: Private Worker BundlerController: Failed to construct initial bundle",
    cause: "Could not resolve",
    detail: "missing-dependency.mjs",
  },
  reload: {
    message:
      "Error: Private Worker LocalRuntimeController: Error reloading local server",
    cause: "Uncaught Error",
    detail: "PRIVATE_WORKER_ORIGIN_RELOAD_FAILURE",
  },
} as const;

for (const phase of ["config", "build", "reload", "disconnect"] as const) {
  test.describe(phase, () => {
    test.use({ phase });
    test(`private Worker native ${phase} before readiness stops cleanly`, async ({
      nativeWorker,
    }) => {
      expect(await nativeWorker.exited).toEqual({ code: 0, signal: null });
      expect(nativeWorker.ready()).toBe(false);
      expect(nativeWorker.log()).not.toMatch(
        /ERR_IPC_CHANNEL_CLOSED|ERR_IPC_DISCONNECTED/,
      );
      if (phase === "disconnect") {
        expect(nativeWorker.disconnectedAtBundle()).toMatch(/^dev-/);
        expect(nativeWorker.errors).toEqual([]);
        expect(nativeWorker.log()).toContain("Private Worker process stopped");
      } else {
        expect([...new Set(nativeWorker.errors)]).toEqual([
          failures[phase].message,
        ]);
        expect(nativeWorker.log()).toContain(failures[phase].cause);
        expect(nativeWorker.log()).toContain(failures[phase].detail);
      }
      expect(() => process.kill(-nativeWorker.processGroup, 0)).toThrow(
        expect.objectContaining({ code: "ESRCH" }),
      );
      expect(await readdir(nativeWorker.temporaryDirectory)).toEqual([]);
    });
  });
}
