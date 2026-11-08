import type { ShellLink } from "@/lib/components/shell/types";

/** Presentation capabilities only; the server request boundary remains authoritative. */
export function isDemoNavigationDestination(href: string) {
  return [
    "/",
    "/workspace/todos",
    "/workspace/subscriptions",
    "/workspace/homeworks",
    "/workspace/exams",
    "/workspace/calendar",
    "/catalog/weather",
    "/catalog/bus",
    "/catalog/bus/map",
    "/catalog/courses",
    "/catalog/sections",
    "/catalog/teachers",
    "/catalog/courses/920001",
    "/catalog/courses/920002",
    "/catalog/courses/920003",
    "/catalog/sections/910001",
    "/catalog/sections/910002",
    "/catalog/sections/910003",
    "/catalog/teachers/401",
    "/catalog/teachers/402",
    "/account/settings/profile",
  ].includes(href);
}

export function demoNavigationLink<Link extends ShellLink>(
  link: Link,
  reason: string,
): Link {
  const items = link.items?.map((item) => demoNavigationLink(item, reason));
  if (!isDemoNavigationDestination(link.href))
    return { ...link, items, disabledReason: reason };
  return {
    ...link,
    items,
  };
}
