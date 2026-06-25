import { formatTime } from "./time-utils";

export function serializeScheduleTimeFields<
  Schedule extends {
    endTime: number | null;
    startTime: number | null;
  },
>(schedule: Schedule) {
  return {
    ...schedule,
    startTime: formatTime(schedule.startTime),
    endTime: formatTime(schedule.endTime),
  };
}

export function serializeScheduleGroupTimeFields<
  Group extends {
    schedules: Array<{
      endTime: number | null;
      startTime: number | null;
    }>;
  },
>(group: Group) {
  return {
    ...group,
    schedules: group.schedules.map(serializeScheduleTimeFields),
  };
}
