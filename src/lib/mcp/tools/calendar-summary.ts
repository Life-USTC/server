import {
  type CalendarSection,
  currentSemesterCalendarSections,
  redactCalendarLocationPair,
  summarizeCalendarSection,
} from "./calendar-summary-sections";

type CalendarSubscriptionSummaryInput = {
  userId: unknown;
  sections: CalendarSection[];
  calendarPath: string | null;
  calendarUrl: string | null;
  note: string;
};

export function summarizeCalendarSubscription(
  subscription: CalendarSubscriptionSummaryInput,
) {
  const currentSemesterSections = currentSemesterCalendarSections(
    subscription.sections,
  );
  const { calendarPath, calendarUrl } =
    redactCalendarLocationPair(subscription);

  return {
    userId: typeof subscription.userId === "string" ? subscription.userId : "",
    sectionCount: subscription.sections.length,
    currentSemesterSectionCount: currentSemesterSections.length,
    currentSemesterSections: currentSemesterSections.map(
      summarizeCalendarSection,
    ),
    calendarPath,
    calendarUrl,
    note: subscription.note,
  };
}

export function summarizeCalendarSubscriptionBrief(
  subscription: CalendarSubscriptionSummaryInput,
) {
  const summary = summarizeCalendarSubscription(subscription);
  return {
    userId: summary.userId,
    sectionCount: summary.sectionCount,
    currentSemesterSectionCount: summary.currentSemesterSectionCount,
    calendarPath: summary.calendarPath,
    calendarUrl: summary.calendarUrl,
    note: summary.note,
  };
}
