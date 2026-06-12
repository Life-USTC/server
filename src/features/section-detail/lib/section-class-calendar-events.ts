import type { SectionCalendarEvent } from "./calendar";
import { dateKey as buildDateKey, formatTime, timeSort } from "./date-display";
import { formatMessage, primaryName, teacherName } from "./display";
import { calendarDetail } from "./section-calendar-detail-rows";
import type {
  ScheduleItem,
  SectionDetailCopy,
  SectionDetailSection,
} from "./section-calendar-event-types";

function roomLocationParts(schedule: ScheduleItem) {
  if (schedule.customPlace) return [schedule.customPlace];
  const room = primaryName(schedule.room);
  const building = primaryName(schedule.room?.building);
  const campus = primaryName(schedule.room?.building?.campus);
  return [room, building, campus].filter((part): part is string =>
    Boolean(part),
  );
}

function roomLabel(schedule: ScheduleItem, sectionCopy: SectionDetailCopy) {
  const parts = roomLocationParts(schedule);
  return parts.length > 0 ? parts.join(" · ") : sectionCopy.roomTbd;
}

function roomDetailRows(
  schedule: ScheduleItem,
  sectionCopy: SectionDetailCopy,
  notAvailable: string,
) {
  if (schedule.customPlace) {
    return calendarDetail(
      sectionCopy.location,
      schedule.customPlace,
      notAvailable,
    );
  }
  return [
    ...calendarDetail(
      sectionCopy.location,
      primaryName(schedule.room),
      notAvailable,
    ),
    ...calendarDetail(
      sectionCopy.schedulingDetails,
      primaryName(schedule.room?.building),
      notAvailable,
    ),
    ...calendarDetail(
      sectionCopy.campus,
      primaryName(schedule.room?.building?.campus),
      notAvailable,
    ),
  ];
}

export function buildSectionClassCalendarEvents({
  notAvailable,
  section,
  sectionCopy,
}: {
  notAvailable: string;
  section: SectionDetailSection;
  sectionCopy: SectionDetailCopy;
}): SectionCalendarEvent[] {
  return section.schedules.map((schedule, index) => ({
    id: `schedule-${index}-${schedule.weekIndex ?? "x"}-${schedule.startTime ?? "x"}-${buildDateKey(schedule.date) ?? "unscheduled"}`,
    kind: "class" as const,
    date: schedule.date ?? null,
    dateKey: buildDateKey(schedule.date),
    title: sectionCopy.classEventTitle,
    meta: `${formatTime(schedule.startTime, notAvailable)}-${formatTime(schedule.endTime, notAvailable)} · ${roomLabel(schedule, sectionCopy)}`,
    badges: [
      schedule.weekIndex !== null && schedule.weekIndex !== undefined
        ? formatMessage(sectionCopy.weekNumber, {
            week: String(schedule.weekIndex),
          })
        : null,
      `${sectionCopy.units} ${schedule.startUnit ?? "?"}-${schedule.endUnit ?? "?"}`,
      ...schedule.teachers.map(teacherName),
    ].filter((badge): badge is string => Boolean(badge)),
    details: [
      ...calendarDetail(sectionCopy.week, schedule.weekIndex, notAvailable),
      ...calendarDetail(
        sectionCopy.units,
        `${schedule.startUnit ?? "?"}-${schedule.endUnit ?? "?"}`,
        notAvailable,
      ),
      ...roomDetailRows(schedule, sectionCopy, notAvailable),
      ...calendarDetail(
        sectionCopy.teacher,
        schedule.teachers.map(teacherName).join(", "),
        notAvailable,
      ),
    ],
    sortValue: timeSort(schedule.startTime),
  }));
}
