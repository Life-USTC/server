export function calendarResponse(
  icsData: string,
  filename: string,
  cacheControl: string,
  headers: HeadersInit = {},
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "text/calendar; charset=utf-8");
  responseHeaders.set(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  responseHeaders.set("Cache-Control", cacheControl);

  return new Response(icsData, {
    headers: responseHeaders,
  });
}

export function calendarNotModifiedResponse(
  cacheControl: string,
  headers: HeadersInit = {},
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", cacheControl);

  return new Response(null, {
    status: 304,
    headers: responseHeaders,
  });
}
