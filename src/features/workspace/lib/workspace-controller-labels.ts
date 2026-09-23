export function buildCalendarWeekdayLabels(sectionCopy: {
  weekdays: {
    shortFriday: string;
    shortMonday: string;
    shortSaturday: string;
    shortSunday: string;
    shortThursday: string;
    shortTuesday: string;
    shortWednesday: string;
  };
}) {
  return [
    sectionCopy.weekdays.shortSunday,
    sectionCopy.weekdays.shortMonday,
    sectionCopy.weekdays.shortTuesday,
    sectionCopy.weekdays.shortWednesday,
    sectionCopy.weekdays.shortThursday,
    sectionCopy.weekdays.shortFriday,
    sectionCopy.weekdays.shortSaturday,
  ];
}
