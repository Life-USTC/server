import type dayjs from "dayjs";
import { toMinutes } from "@/shared/lib/time-utils";
import type { SessionItem, TimeSlot } from "./dashboard-types";

export const buildWeekDays = (weekStart: dayjs.Dayjs) =>
  Array.from({ length: 7 }, (_, index) => weekStart.add(index, "day"));

export const buildTimeSlots = (weeklySessions: SessionItem[]): TimeSlot[] => {
  const slotsByKey = new Map<string, TimeSlot>();

  for (const { startTime, endTime } of weeklySessions) {
    const key = `${startTime}-${endTime}`;
    if (!slotsByKey.has(key)) {
      slotsByKey.set(key, { key, startTime, endTime });
    }
  }

  return [...slotsByKey.values()].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
  );
};
