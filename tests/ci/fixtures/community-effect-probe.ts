import type {
  ExecutionContext,
  KVNamespace,
  MessageBatch,
  Queue,
} from "@cloudflare/workers-types";

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

type CalendarProbeEnv = {
  NODE_ENV: string;
  E2E_STORAGE_SECRET: string;
  CALENDAR_EXPORTS: KVNamespace;
};
type CalendarAttempt = {
  id: string;
  attempts: number;
  userId: string;
  ackCalls: number;
  retryCalls: number;
  complete: boolean;
  errors: string[];
  calendar: string | null;
};
const calendarPrefix = (userId: string) =>
  `__test:calendar-consumer:${userId}:`;

/** Exact private-actor observations; reads never trigger a feed rebuild. */
export async function handleCalendarConsumerProbe(
  request: Request,
  env: CalendarProbeEnv,
) {
  const url = new URL(request.url);
  if (url.pathname !== "/__test/calendar-consumer") return undefined;
  if (!authorized(request, env)) return new Response(null, { status: 404 });
  const userId = url.searchParams.get("userId") ?? "";
  if (!validId.test(userId))
    return new Response("Expected private actor UUID", { status: 400 });
  const prefix = calendarPrefix(userId);
  if (request.method === "POST") {
    if (await env.CALENDAR_EXPORTS.get(`${prefix}enabled`))
      return new Response("Probe already exists", { status: 409 });
    await env.CALENDAR_EXPORTS.put(`${prefix}enabled`, "true");
    return new Response(null, { status: 201 });
  }
  if (request.method !== "GET") return new Response(null, { status: 405 });
  if (!(await env.CALENDAR_EXPORTS.get(`${prefix}enabled`)))
    return new Response(null, { status: 404 });
  const records: (CalendarAttempt | null)[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.CALENDAR_EXPORTS.list({
      prefix: `${prefix}attempt:`,
      cursor,
    });
    records.push(
      ...(await Promise.all(
        listed.keys.map(({ name }) =>
          env.CALENDAR_EXPORTS.get<CalendarAttempt>(name, "json"),
        ),
      )),
    );
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
  return Response.json({
    attempts: records,
    calendar: await env.CALENDAR_EXPORTS.get(`user-calendar:v2:${userId}`),
  });
}

/** Wrap native delivery/ack/retry, preserving envelopes and the real consumer. */
export async function observeCalendarConsumer(
  batch: MessageBatch,
  env: CalendarProbeEnv,
  context: ExecutionContext,
  consume: (batch: MessageBatch, context: ExecutionContext) => Promise<void>,
) {
  if (
    env.NODE_ENV !== "test" ||
    !env.E2E_STORAGE_SECRET ||
    batch.queue !== "life-ustc-calendar-export-rebuild"
  )
    return consume(batch, context);
  const attempts = new Map<string, CalendarAttempt>();
  for (const message of batch.messages) {
    const body = message.body;
    if (
      !body ||
      typeof body !== "object" ||
      !("type" in body) ||
      body.type !== "user" ||
      !("userId" in body) ||
      typeof body.userId !== "string" ||
      !validId.test(body.userId) ||
      !(await env.CALENDAR_EXPORTS.get(`${calendarPrefix(body.userId)}enabled`))
    )
      continue;
    attempts.set(message.id, {
      id: message.id,
      attempts: message.attempts,
      userId: body.userId,
      ackCalls: 0,
      retryCalls: 0,
      complete: false,
      errors: [],
      calendar: null,
    });
  }
  if (!attempts.size) return consume(batch, context);
  const persist = (attempt: CalendarAttempt) =>
    env.CALENDAR_EXPORTS.put(
      `${calendarPrefix(attempt.userId)}attempt:${attempt.id}:${attempt.attempts}`,
      JSON.stringify(attempt),
    );
  await Promise.all([...attempts.values()].map(persist));
  const messages = batch.messages.map((message) => {
    const attempt = attempts.get(message.id);
    if (!attempt) return message;
    return new Proxy(message, {
      get(target, property) {
        if (property === "ack")
          return () => {
            target.ack();
            attempt.ackCalls++;
          };
        if (property === "retry")
          return (options?: Parameters<typeof target.retry>[0]) => {
            target.retry(options);
            attempt.retryCalls++;
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
  const observedBatch = new Proxy(batch, {
    get(target, property) {
      if (property === "messages") return messages;
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const tasks: Promise<unknown>[] = [];
  const errors: unknown[] = [];
  let consumerFailed = false;
  let consumerError: unknown;
  const observedContext = new Proxy(context, {
    get(target, property) {
      if (property === "waitUntil")
        return (promise: Promise<unknown>) => {
          const task = promise.catch((error) => {
            errors.push(error);
            throw error;
          });
          tasks.push(task);
          target.waitUntil(task);
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  try {
    await consume(observedBatch, observedContext);
  } catch (error) {
    consumerFailed = true;
    consumerError = error;
    errors.push(error);
  }
  let seen = 0;
  while (seen < tasks.length) {
    const next = tasks.slice(seen);
    seen += next.length;
    await Promise.allSettled(next);
  }
  for (const attempt of attempts.values()) {
    attempt.complete = true;
    attempt.errors = errors.map(errorMessage);
    attempt.calendar = await env.CALENDAR_EXPORTS.get(
      `user-calendar:v2:${attempt.userId}`,
    );
    await persist(attempt);
  }
  if (consumerFailed) throw consumerError;
  if (errors.length)
    throw new AggregateError(errors, "Observed calendar consumer failed");
}
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
              const service = Reflect.apply(factory, exports, [options]);
              if (!service || typeof service !== "object")
                throw new Error("Expected native PublicSsr service stub");
              return new Proxy(service, {
                get(stub, method) {
                  const operation = Reflect.get(stub, method);
                  if (method === "purgeCatalogRepresentations")
                    return () =>
                      observe(
                        probe.purges,
                        undefined,
                        async () => Reflect.apply(operation, stub, []),
                        true,
                      );
                  return typeof operation === "function"
                    ? (...args: unknown[]) =>
                        Reflect.apply(operation, stub, args)
                    : operation;
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
