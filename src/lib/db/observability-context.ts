import { AsyncLocalStorage } from "node:async_hooks";
import { setRuntimeIssueRecorder } from "@/lib/log/app-log-emitter";
import {
  type FeatureEventInput,
  type RuntimeIssueInput,
  writeObservabilityBatch,
} from "./feature-event-store";

const MAX_EVENTS = 256;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Batch = {
  features: FeatureEventInput[];
  issues: RuntimeIssueInput[];
  requestId?: string | null;
  hasError: boolean;
  count: number;
  dropped: number;
  closed: boolean;
  flushing: boolean;
  schedule?: (task: Promise<unknown>) => void;
  userId?: string;
  authMode?: "session" | "oauth";
};
const storage = new AsyncLocalStorage<Batch>();

export function safeObservabilityRequestId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

export function identifyObservedRequest(requestId: string) {
  const batch = storage.getStore();
  if (batch) batch.requestId = safeObservabilityRequestId(requestId);
}

/** Reuse an already verified identity; this never resolves authentication. */
export function identifyObservedUser(
  userId: string,
  authMode: "session" | "oauth",
) {
  const batch = storage.getStore();
  if (batch) Object.assign(batch, { userId, authMode });
}

function reserveEvent(batch: Batch) {
  if (batch.count >= MAX_EVENTS) {
    batch.dropped += 1;
    if (batch.dropped === 1)
      console.warn(
        JSON.stringify({
          event: "observability.events-dropped",
          limit: MAX_EVENTS,
        }),
      );
    return false;
  }
  batch.count += 1;
  return true;
}

function flushBatch(batch: Batch) {
  if (batch.flushing || !(batch.features.length || batch.issues.length)) return;
  batch.flushing = true;
  const task = Promise.resolve()
    .then(async () => {
      // Streamed operations can finish after response headers, or during a write.
      // Drain only new events, never replay an already written request batch.
      while (batch.features.length || batch.issues.length) {
        const features = batch.features.splice(0);
        const issues = batch.issues.splice(0);
        try {
          await storage.exit(() =>
            writeObservabilityBatch({ features, issues }),
          );
        } catch {
          console.warn(
            JSON.stringify({
              event: "observability.write-failed",
              count: features.length + issues.length,
            }),
          );
        }
      }
    })
    .finally(() => {
      batch.flushing = false;
      if (batch.features.length || batch.issues.length) flushBatch(batch);
    });
  try {
    batch.schedule?.(task);
  } catch {
    /* The task remains handled on Node. */
  }
}

export function collectFeatureEvent(event: FeatureEventInput) {
  const batch = storage.getStore();
  if (!batch) return;
  if (!reserveEvent(batch)) return;
  batch.features.push({
    ...event,
    userId: event.userId ?? batch.userId ?? null,
    authMode:
      event.authMode === "unknown" && batch.authMode
        ? batch.authMode
        : event.authMode,
  });
  if (batch.closed) flushBatch(batch);
}

/** Only structured event names and safe correlation data enter the database. */
setRuntimeIssueRecorder((level, payload) => {
  const batch = storage.getStore();
  if (!batch || (level !== "warn" && level !== "error")) return;
  const event =
    payload.event ??
    (level === "error" ? "application.error" : "application.warning");
  if (
    typeof event !== "string" ||
    !/^[a-z][a-z0-9._-]{0,95}$/.test(event) ||
    event.startsWith("observability.") ||
    event.startsWith("analytics-engine.") ||
    event === "feature.operation.finish"
  )
    return;
  if (!reserveEvent(batch)) return;
  if (level === "error") batch.hasError = true;
  batch.issues.push({
    id: crypto.randomUUID(),
    occurredAt: new Date(),
    level,
    event,
    requestId:
      safeObservabilityRequestId(payload.requestId) ?? batch.requestId ?? null,
    // Route fields can contain user-supplied paths. Do not persist them here.
    route: null,
    status:
      typeof payload.status === "number" &&
      Number.isInteger(payload.status) &&
      payload.status >= 100 &&
      payload.status <= 599
        ? payload.status
        : null,
  });
  if (batch.closed) flushBatch(batch);
});

/** Bounded request recording, outside the business transaction and response. */
export function runWithObservability<T>(
  run: () => T | Promise<T>,
  schedule?: (task: Promise<unknown>) => void,
  unhandledEvent:
    | "request.unhandled"
    | "queue.unhandled"
    | "scheduled.unhandled" = "request.unhandled",
): Promise<T> {
  if (storage.getStore()) return Promise.resolve().then(run);
  const batch: Batch = {
    features: [],
    issues: [],
    hasError: false,
    count: 0,
    dropped: 0,
    closed: false,
    flushing: false,
    schedule,
  };
  return storage.run(batch, async () => {
    try {
      return await run();
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? error.status
          : undefined;
      if (
        !batch.hasError &&
        !(typeof status === "number" && status < 500) &&
        reserveEvent(batch)
      ) {
        batch.issues.push({
          id: crypto.randomUUID(),
          occurredAt: new Date(),
          level: "error",
          event: unhandledEvent,
          requestId:
            batch.requestId ?? batch.features.at(-1)?.requestId ?? null,
          route: null,
          status:
            typeof status === "number" &&
            Number.isInteger(status) &&
            status <= 599
              ? status
              : 500,
        });
      }
      throw error;
    } finally {
      batch.closed = true;
      flushBatch(batch);
    }
  });
}
