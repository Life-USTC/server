import { LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";

function getCookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return undefined;
}

export function getRequestLocale(request: Request) {
  return negotiateLocale(
    getCookieValue(request, LOCALE_COOKIE),
    request.headers.get("accept-language"),
  );
}
