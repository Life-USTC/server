import { unstable_dev } from "wrangler";

let starting;
let stopping;
function stop() {
  stopping ??= (async () => {
    const worker = await starting?.catch(() => undefined);
    await worker?.stop();
    process.disconnect?.();
    process.exitCode = 0;
  })();
  return stopping;
}
process.on("message", (message) => {
  if (message.type === "start" && !starting) {
    starting = unstable_dev(message.script, message.options);
    void starting.then(
      (worker) => process.send?.({ type: "ready", port: worker.port }),
      (error) => {
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
