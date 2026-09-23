import {
  type CalendarSection,
  currentSemesterCalendarSections,
  summarizeCalendarSection,
} from "./calendar-summary-sections";

type CalendarSubscriptionSummaryInput = {
  userId: unknown;
  sections: CalendarSection[];
  note: string;
};

export function summarizeCalendarSubscription(
  subscription: CalendarSubscriptionSummaryInput,
) {
  const currentSemesterSections = currentSemesterCalendarSections(
    subscription.sections,
  );
  return {
    userId: typeof subscription.userId === "string" ? subscription.userId : "",
    sectionCount: subscription.sections.length,
    currentSemesterSectionCount: currentSemesterSections.length,
    currentSemesterSections: currentSemesterSections.map(
      summarizeCalendarSection,
    ),
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
    note: summary.note,
  };
}
