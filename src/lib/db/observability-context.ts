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
  dropped: number;
  userId?: string;
  authMode?: "session" | "oauth";
};
const storage = new AsyncLocalStorage<Batch>();

export function safeObservabilityRequestId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/** Reuse an already verified identity; this never resolves authentication. */
export function identifyObservedUser(
  userId: string,
  authMode: "session" | "oauth",
) {
  const batch = storage.getStore();
  if (batch) Object.assign(batch, { userId, authMode });
}

export function collectFeatureEvent(event: FeatureEventInput) {
  const batch = storage.getStore();
  if (!batch) return;
  if (batch.features.length + batch.issues.length >= MAX_EVENTS) {
    batch.dropped += 1;
    return;
  }
  batch.features.push({
    ...event,
    userId: event.userId ?? batch.userId ?? null,
    authMode:
      event.authMode === "unknown" && batch.authMode
        ? batch.authMode
        : event.authMode,
  });
}

/** Only structured event names and safe correlation data enter the database. */
setRuntimeIssueRecorder((level, payload) => {
  const batch = storage.getStore();
  if (!batch || (level !== "warn" && level !== "error")) return;
  const event = payload.event;
  if (
    typeof event !== "string" ||
    !/^[a-z][a-z0-9._-]{0,95}$/.test(event) ||
    event.startsWith("observability.") ||
    event.startsWith("analytics-engine.") ||
    event === "feature.operation.finish"
  )
    return;
  if (batch.features.length + batch.issues.length >= MAX_EVENTS) {
    batch.dropped += 1;
    return;
  }
  batch.issues.push({
    id: crypto.randomUUID(),
    occurredAt: new Date(),
    level,
    event,
    requestId: safeObservabilityRequestId(payload.requestId),
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
});

/** One bounded batch per request, outside its business transaction and response. */
export function runWithObservability<T>(
  run: () => T | Promise<T>,
  schedule?: (task: Promise<unknown>) => void,
): Promise<T> {
  if (storage.getStore()) return Promise.resolve().then(run);
  const batch: Batch = { features: [], issues: [], dropped: 0 };
  return storage.run(batch, async () => {
    try {
      return await run();
    } finally {
      if (batch.dropped) {
        // Direct console avoids recursively recording failures of the recorder.
        console.warn(
          JSON.stringify({
            event: "observability.events-dropped",
            count: batch.dropped,
          }),
        );
      }
      if (batch.features.length || batch.issues.length) {
        // A detached client owns its connection until the complete batch finishes.
        const task = Promise.resolve()
          .then(() => writeObservabilityBatch(batch))
          .catch(() => {
            console.warn(
              JSON.stringify({
                event: "observability.write-failed",
                count: batch.features.length + batch.issues.length,
              }),
            );
          });
        try {
          schedule?.(task);
        } catch {
          /* The task remains handled on Node. */
        }
      }
    }
  });
}
