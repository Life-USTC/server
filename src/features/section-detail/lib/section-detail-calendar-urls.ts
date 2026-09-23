export function sectionDetailCalendarUrls(input: {
  jwId: string | number;
  origin: string;
}) {
  const singlePath = `/api/catalog/sections/${input.jwId}/calendar.ics`;
  return {
    singleCalendarPath: singlePath,
    singleCalendarUrl: input.origin
      ? `${input.origin}${singlePath}`
      : singlePath,
  };
}
