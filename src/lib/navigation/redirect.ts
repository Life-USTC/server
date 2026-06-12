import { goto } from "$app/navigation";

export function redirectWithExternalFallback(location: string) {
  const target = new URL(location, window.location.href);
  if (target.origin === window.location.origin) {
    return goto(`${target.pathname}${target.search}${target.hash}`, {
      invalidateAll: true,
    });
  }
  window.location.href = target.href;
}
