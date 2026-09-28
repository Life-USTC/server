import type { ExecutionContext, Queue } from "@cloudflare/workers-types";

type Effect = {
  outcome: "pending" | "fulfilled" | "rejected";
  value?: unknown;
  result?: unknown;
  error?: string;
};
type Probe = {
  tasks: Promise<unknown>[];
  backgroundErrors: string[];
  purges: Effect[];
  messages: Effect[];
};
const probes = new Map<string, Probe>();
const path = "/__test/community-effects";
const validId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const authorized = (
  request: Request,
  env: { NODE_ENV: string; E2E_STORAGE_SECRET: string },
) =>
  env.NODE_ENV === "test" &&
  !!env.E2E_STORAGE_SECRET &&
  request.headers.get("x-test-storage-secret") === env.E2E_STORAGE_SECRET;
async function drain(probe: Probe) {
  // A task may enqueue further work while completing. Only this probe's tasks are awaited.
  let seen = 0;
  while (seen < probe.tasks.length) {
    const tasks = probe.tasks.slice(seen);
    seen += tasks.length;
    await Promise.allSettled(tasks);
  }
}
export async function handleCommunityEffectProbe(
  request: Request,
  env: { NODE_ENV: string; E2E_STORAGE_SECRET: string },
) {
  const url = new URL(request.url);
  if (url.pathname !== path) return undefined;
  if (!authorized(request, env)) return new Response(null, { status: 404 });
  const id = url.searchParams.get("id") ?? "";
  if (!validId.test(id))
    return new Response("Expected UUID probe", { status: 400 });
  if (request.method === "POST") {
    if (probes.has(id))
      return new Response("Probe already exists", { status: 409 });
    probes.set(id, {
      tasks: [],
      backgroundErrors: [],
      purges: [],
      messages: [],
    });
    return new Response(null, { status: 201 });
  }
  const probe = probes.get(id);
  if (!probe) return new Response(null, { status: 404 });
  await drain(probe);
  if (request.method === "DELETE") {
    probes.delete(id);
    return new Response(null, { status: 204 });
  }
  if (request.method !== "GET") return new Response(null, { status: 405 });
  return Response.json({
    purges: probe.purges,
    messages: probe.messages,
    backgroundErrors: probe.backgroundErrors,
  });
}

/** Observe real calls without substituting the queue or cache implementation. */
export function observeCommunityEffects<
  T extends {
    NODE_ENV: string;
    E2E_STORAGE_SECRET: string;
    CALENDAR_EXPORT_REBUILD?: Queue;
  },
>(request: Request, env: T, context: ExecutionContext) {
  const id = request.headers.get("x-test-community-probe") ?? "";
  const probe =
    authorized(request, env) && validId.test(id) ? probes.get(id) : undefined;
  if (!probe) return { env, context };
  async function observe<T>(
    effects: Effect[],
    value: unknown,
    work: () => Promise<T>,
    recordResult = false,
  ) {
    const effect: Effect = { outcome: "pending", value };
    effects.push(effect);
    try {
      const result = await work();
      effect.outcome = "fulfilled";
      if (recordResult) effect.result = result;
      return result;
    } catch (error) {
      effect.outcome = "rejected";
      effect.error = errorMessage(error);
      throw error;
    }
  }
  const observedEnv = env.CALENDAR_EXPORT_REBUILD
    ? {
        ...env,
        CALENDAR_EXPORT_REBUILD: new Proxy(env.CALENDAR_EXPORT_REBUILD, {
          get(target, property) {
            if (property === "send")
              return (body: unknown, options?: unknown) =>
                observe(probe.messages, structuredClone(body), () =>
                  target.send(body, options as Parameters<Queue["send"]>[1]),
                );
            const value = Reflect.get(target, property);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
      }
    : env;
  const observedContext = new Proxy(context, {
    get(target, property) {
      if (property === "waitUntil")
        return (promise: Promise<unknown>) => {
          const task = promise.catch((error) => {
            probe.backgroundErrors.push(errorMessage(error));
            throw error;
          });
          probe.tasks.push(task);
          target.waitUntil(task);
        };
      const value = Reflect.get(target, property);
      if (property === "exports" && value)
        return new Proxy(value, {
          get(exports, entrypoint) {
            const factory = Reflect.get(exports, entrypoint);
            if (entrypoint !== "PublicSsr") return factory;
            return (options: unknown) => {
              const service = factory(options);
              return new Proxy(service, {
                get(stub, method) {
                  const operation = Reflect.get(stub, method);
                  if (method === "purgeCatalogRepresentations")
                    return () =>
                      observe(probe.purges, undefined, () => operation(), true);
                  return operation;
                },
              });
            };
          },
        });
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { env: observedEnv, context: observedContext };
}
