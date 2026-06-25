/**
 * Minimal shape for schedule location formatting.
 * Compatible with both Prisma-selected and client-fetched schedules.
 */
export type ScheduleLocationInfo = {
  customPlace: string | null;
  room: {
    namePrimary: string;
    building: {
      namePrimary: string;
      campus: { namePrimary: string } | null;
    } | null;
  } | null;
};

/**
 * Formats a schedule's location string from room -> building -> campus.
 */
export function formatScheduleLocation(schedule: ScheduleLocationInfo): string {
  if (schedule.customPlace) return schedule.customPlace;
  if (!schedule.room) return "—";

  const parts = [schedule.room.namePrimary];
  if (schedule.room.building) {
    parts.push(schedule.room.building.namePrimary);
    if (schedule.room.building.campus) {
      parts.push(schedule.room.building.campus.namePrimary);
    }
  }

  return parts.join(" · ");
}
