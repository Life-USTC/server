export function calendarResponse(
  icsData: string,
  filename: string,
  cacheControl: string,
) {
  return new Response(icsData, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": cacheControl,
    },
  });
}

export function parseUserCalendarIdentifier(rawUserId: string) {
  const separatorIndex = rawUserId.indexOf(":");
  if (separatorIndex === -1) {
    return {
      userId: rawUserId,
      tokenFromPath: null,
    };
  }

  return {
    userId: rawUserId.slice(0, separatorIndex),
    tokenFromPath: rawUserId.slice(separatorIndex + 1),
  };
}
