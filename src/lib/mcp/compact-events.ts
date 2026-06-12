import { isRecord } from "@/lib/utils";
import { EVENT_PAYLOAD_COMPACTORS } from "./compact-dispatch";
import { asRecordArray, pick } from "./compact-helpers";

export function compactEvents(
  value: unknown[],
  fallbackCompact: (value: unknown) => unknown,
) {
  return asRecordArray(value).map((event) => {
    const base = pick(event, ["type", "at"]);
    if (!Object.hasOwn(event, "payload")) return base;
    const compactFn =
      isRecord(event) && typeof event.type === "string"
        ? EVENT_PAYLOAD_COMPACTORS[event.type]
        : undefined;
    return {
      ...base,
      payload: (compactFn ?? fallbackCompact)(event.payload),
    };
  });
}
