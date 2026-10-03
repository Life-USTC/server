import { setCloudflareCatalogInvalidator } from "@/lib/adapters/cloudflare-runtime";
import { createNodeRuntime } from "./node-runtime";

type NodeRuntime = ReturnType<typeof createNodeRuntime>;
export type NodeProtocolRuntime = {
  setPublicOrigin(origin: string): void;
  run: NodeRuntime["run"];
  request: NodeRuntime["run"];
  drain: NodeRuntime["close"];
  close: NodeRuntime["close"];
};

/** Own protocol workflow/request lifetimes without acquiring database fixtures. */
export function createNodeProtocolRuntime(
  bindings: Record<string, unknown> & { APP_PUBLIC_ORIGIN: string },
): NodeProtocolRuntime {
  const env = { ...bindings };
  let originLocked = false;
  let originConfigured = false;
  const lifetime = createNodeRuntime(env);
  const requests = createNodeRuntime(env);
  function scoped(runtime: NodeRuntime): NodeRuntime["run"] {
    return (work) => {
      originLocked = true;
      return runtime.run(() => {
        // These Node contracts have no Worker HTML cache; Worker tests cover
        // delivery and invalidation. Both bindings remain local to this request.
        setCloudflareCatalogInvalidator(async () => {});
        return work();
      });
    };
  }
  let closing: Promise<void> | undefined;
  function close() {
    closing ??= (async () => {
      const results = await Promise.allSettled([lifetime.close()]);
      results.push(...(await Promise.allSettled([requests.close()])));
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "Node protocol cleanup failed");
    })();
    return closing;
  }
  return {
    setPublicOrigin(origin) {
      if (originLocked || originConfigured || closing)
        throw new Error("Configure the public origin once before runtime work");
      const parsed = new URL(origin);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.origin !== origin
      )
        throw new Error("The public origin must be an HTTP(S) origin only");
      env.APP_PUBLIC_ORIGIN = origin;
      originConfigured = true;
    },
    run: scoped(lifetime),
    request: scoped(requests),
    drain() {
      originLocked = true;
      return lifetime.close();
    },
    close,
  };
}
