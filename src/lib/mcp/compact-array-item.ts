import { isRecord } from "@/lib/utils";
import { compactBusArrayItem } from "./compact-array-bus-item";
import { compactEntityArrayItem } from "./compact-array-entity-item";
import { compactCalendarSubscription } from "./compact-calendar";

export function compactArrayItem(
  value: unknown,
  compactMcpPayload: (value: unknown) => unknown,
): unknown {
  if (!isRecord(value)) return compactMcpPayload(value);

  if (
    Object.hasOwn(value, "sections") &&
    (Object.hasOwn(value, "calendarPath") ||
      Object.hasOwn(value, "calendarUrl"))
  ) {
    return compactCalendarSubscription(value);
  }

  const busItem = compactBusArrayItem(value);
  if (busItem.matched) return busItem.value;

  const entityItem = compactEntityArrayItem(value);
  if (entityItem.matched) return entityItem.value;

  return compactMcpPayload(value);
}
