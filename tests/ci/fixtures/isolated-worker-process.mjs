import { createRequire } from "node:module";
import { unstable_readConfig, unstable_startWorker } from "wrangler";

let worker;
let starting;
let stopping;
const abort = new AbortController();
const cancelled = new Promise((_, reject) => {
  abort.signal.addEventListener("abort", () => reject(abort.signal.reason), {
    once: true,
  });
});
void cancelled.catch(() => undefined);

async function start(options) {
  const config = unstable_readConfig({ config: options.config });
  const require = createRequire(options.config);
  // The process owns its temporary build directory. Resolve configured aliases
  // from the source config before Wrangler bundles from that private directory.
  worker = await unstable_startWorker({
    ...options,
    build: {
      alias: Object.fromEntries(
        Object.entries(config.alias ?? {}).map(([name, target]) => [
          name,
          require.resolve(target),
        ]),
      ),
    },
  });
  const fail = (event) => {
    const error =
      event instanceof Error
        ? event
        : new Error(`Private Worker ${event.source}: ${event.reason}`, {
            cause: event.cause,
          });
    console.error(error);
    abort.abort(error);
    if (process.connected)
      process.send?.({ type: "error", message: String(error) });
    void stop();
  };
  worker.raw.on("error", fail);
  worker.raw.on("buildFailed", fail);
  const initialReload = new Promise((resolve) => {
    worker.raw.once("reloadComplete", resolve);
  });
  abort.signal.throwIfAborted();
  const url = await Promise.race([worker.url, cancelled]);
  // A config update starts a new build. Settle the first build before replacing
  // its temporary directory so its asynchronous writes cannot recreate it later.
  await Promise.race([initialReload, cancelled]);
  const origin = `http://localhost:${url.port}`;
  // Only the application binding changes. Wrangler retains its bound HTTP
  // listener while reloading the application, avoiding a check/close/bind race.
  let acknowledge;
  const reloaded = new Promise((resolve) => {
    acknowledge = resolve;
  });
  const onReload = (event) => {
    const binding = event.config.bindings.APP_PUBLIC_ORIGIN;
    if (binding?.type === "plain_text" && binding.value === origin)
      acknowledge();
  };
  worker.raw.on("reloadComplete", onReload);
  try {
    const updated = await Promise.race([
      worker.patchConfig({
        // Wrangler patches input fields shallowly, including the bindings map.
        bindings: {
          ...options.bindings,
          APP_PUBLIC_ORIGIN: { type: "plain_text", value: origin },
        },
      }),
      cancelled,
    ]);
    if (!updated)
      throw new Error("Private Worker origin binding update failed");
    await Promise.race([reloaded, cancelled]);
  } finally {
    worker.raw.off("reloadComplete", onReload);
  }
  abort.signal.throwIfAborted();
  if ((await worker.url).href !== url.href)
    throw new Error(
      "Private Worker listener changed during origin binding update",
    );
  return Number(url.port);
}
function stop() {
  abort.abort(new Error("Private Worker process stopped"));
  stopping ??= (async () => {
    await starting?.catch(() => undefined);
    // dispose() waits for readiness first. Teardown must also work when startup
    // has not reached readiness, so use the DevEnv's exposed teardown directly.
    await worker?.raw.teardown();
    if (process.connected) process.disconnect?.();
    process.exitCode = 0;
  })();
  return stopping;
}
process.on("message", (message) => {
  if (message.type === "start" && !starting) {
    starting = start(message.options);
    void starting.then(
      (port) => {
        if (process.connected) process.send?.({ type: "ready", port });
      },
      (error) => {
        console.error(error);
        if (process.connected)
          process.send?.({ type: "error", message: String(error) });
        void stop();
      },
    );
  } else if (message.type === "stop") {
    void stop();
  }
});
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
process.on("disconnect", () => void stop());
