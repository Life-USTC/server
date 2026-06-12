export type SectionCalendarEvent = {
  badges: string[];
  date: string | Date | null;
  dateKey: string | null;
  details: Array<{ label: string; value: string }>;
  id: string;
  kind: "class" | "exam";
  meta: string;
  title: string;
};

export type SectionCalendarCopy = {
  addToCalendar: string;
  calendarEmpty: string;
  classEvent: string;
  dateTBD: string;
  examEvent: string;
  moreEvents: string;
  nextMonth: string;
  previousMonth: string;
  today: string;
  weekLabel: string;
  weekdays: {
    shortFriday: string;
    shortMonday: string;
    shortSaturday: string;
    shortSunday: string;
    shortThursday: string;
    shortTuesday: string;
    shortWednesday: string;
  };
};
