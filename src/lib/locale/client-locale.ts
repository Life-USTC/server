import type { AppLocale } from "@/i18n/config";

export async function setClientLocale({
  currentLocale,
  locale,
  onBeforeRequest,
}: {
  currentLocale: AppLocale;
  locale: AppLocale;
  onBeforeRequest: () => void;
}) {
  onBeforeRequest();
  if (locale === currentLocale) return;
  const response = await fetch("/api/locale", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (response.ok) {
    window.location.reload();
  }
}
