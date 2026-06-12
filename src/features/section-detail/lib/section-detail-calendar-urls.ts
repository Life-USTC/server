export function sectionDetailCalendarUrls(input: {
  jwId: string | number;
  origin: string;
  subscriptionPath: string;
}) {
  const singlePath = `/api/sections/${input.jwId}/calendar.ics`;
  return {
    singleCalendarPath: singlePath,
    singleCalendarUrl: input.origin
      ? `${input.origin}${singlePath}`
      : singlePath,
    subscriptionCalendarPath: input.subscriptionPath,
    subscriptionCalendarUrl:
      input.origin && input.subscriptionPath
        ? `${input.origin}${input.subscriptionPath}`
        : input.subscriptionPath,
  };
}
