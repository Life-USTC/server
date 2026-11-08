import type { ShellLink } from "@/lib/components/shell/types";
import { isDemoNewsId } from "./demo-news-ids";
import { isDemoYoungId, isDemoYoungOrganizerId } from "./demo-young-ids";

/** Presentation capabilities only; the server request boundary remains authoritative. */
export function isDemoNavigationDestination(href: string) {
  if (href.startsWith("/news/") && isDemoNewsId(href.slice("/news/".length)))
    return true;
  if (
    href.startsWith("/catalog/young-events/organizers/") &&
    isDemoYoungOrganizerId(
      href.slice("/catalog/young-events/organizers/".length),
    )
  )
    return true;
  if (
    href.startsWith("/catalog/young-events/") &&
    isDemoYoungId(href.slice("/catalog/young-events/".length))
  )
    return true;
  return [
    "/catalog/young-events",
    "/catalog/young-events/calendar",
    "/catalog/young-events/organizers",
    "/",
    "/workspace/todos",
    "/workspace/subscriptions",
    "/workspace/subscriptions/activities",
    "/workspace/subscriptions/activities?view=events",
    "/workspace/subscriptions/activities?view=organizers",
    "/workspace/subscriptions/activities?view=notifications",
    "/workspace/subscriptions/activities?view=notifications&unread=true",
    "/workspace/homeworks",
    "/workspace/exams",
    "/workspace/calendar",
    "/news",
    "/news/sources",
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
