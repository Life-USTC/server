import {
  DEMO_REFERENCE_NOW,
  type DemoIdentity,
} from "@/features/demo/lib/demo-types";
import type {
  AnonymousHomeInformation,
  HomeCampusNow,
} from "@/features/workspace/server/anonymous-home-sections";
import { getAnonymousHomePageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { DEMO_BUS_HUB, getDemoBusNext, getDemoBusTimetable } from "./demo-bus";
import { getDemoCalendar } from "./demo-calendar";
import { getDemoHomeworksTabData } from "./demo-homeworks";
import { getDemoCatalogLinksData } from "./demo-links";
import { getDemoNewsHomeNotices } from "./demo-news";
import { getDemoTodos } from "./demo-todos";
import { getDemoWeatherSnapshot } from "./demo-weather";
import {
  getDemoCopy,
  getDemoView,
  getDemoWorkspacePage,
} from "./demo-workspace";
import { getDemoYoungHomeActivities } from "./demo-young";

/** Sealed fictional editorial content: never a publication, provider or bus read. */
export function getDemoHomeInformation(
  locale: AppLocale,
): AnonymousHomeInformation {
  return {
    notices: getDemoNewsHomeNotices(locale),
    activities: getDemoYoungHomeActivities(locale),
  };
}

export function getDemoHomePage(identity: DemoIdentity, locale: AppLocale) {
  const homeCopy = getAnonymousHomePageCopy(locale);
  return {
    demo: getDemoView(identity, locale),
    homeSampleNotice: getDemoCopy(locale).homeSamples,
    homeCopy,
    information: getDemoHomeInformation(locale),
    locale,
    mainContentLabel: homeCopy.homepage.publicWorkspace.title,
  };
}

export function getDemoHomeCampusNow(
  locale: AppLocale,
  section?: "bus" | "weather",
): HomeCampusNow {
  const english = locale === "en-us";
  return {
    weather:
      section === "bus"
        ? null
        : (["ustc-main", "ustc-gaoxin"] as const).map((locationKey) => {
            const snapshot = getDemoWeatherSnapshot(locationKey, locale);
            const today = snapshot.daily[0];
            return {
              locationKey,
              temperature: `${snapshot.current.temperature}°C`,
              condition: snapshot.current.condition.text,
              rangeLabel: `${today.temperatureLow}–${today.temperatureHigh}°C`,
              hourly: snapshot.hourly.slice(0, 3).map((hour) => ({
                key: `${locationKey}-${hour.at}`,
                label: shanghaiDayjs(hour.at).format("HH:mm"),
                temperature: `${hour.temperature}°C`,
              })),
            };
          }),
    bus:
      section === "weather"
        ? null
        : {
            originNote: english
              ? "Fictional departures from Sample Campus · Not a real timetable"
              : "虚构样例校区班次 · 非真实时刻表",
            emptyNote: english ? "No fictional departures" : "暂无虚构班次",
            departures: (getDemoBusTimetable(locale)?.campuses ?? [])
              .filter((campus) => campus.id !== DEMO_BUS_HUB)
              .flatMap(
                (campus) =>
                  getDemoBusNext(locale, {
                    originCampusId: DEMO_BUS_HUB,
                    destinationCampusId: campus.id,
                  })?.departures ?? [],
              )
              .map((departure) => ({
                key: `demo-bus-${departure.tripId}`,
                destination: departure.destinationCampus?.namePrimary ?? "",
                departureTime: departure.departureTime ?? "",
                relativeLabel: english
                  ? `In ${departure.minutesUntilDeparture} min`
                  : `${departure.minutesUntilDeparture} 分钟后`,
              })),
          },
  };
}

/** Queries may select fixture weeks, never a different clock or a real owner. */
export function getDemoHomeOverview(
  identity: DemoIdentity,
  locale: AppLocale,
  query = new URLSearchParams(),
) {
  const calendar = getDemoCalendar(identity, locale);
  const snapshotAt = query.get("snapshotAt");
  const overviewWeek = query.get("overviewWeek");
  const firstVisibleDate = calendar.semesterWeeks[0]?.[0];
  const lastVisibleDate = calendar.semesterWeeks.at(-1)?.at(-1);
  if (
    snapshotAt !== null &&
    new Date(snapshotAt).getTime() !== new Date(DEMO_REFERENCE_NOW).getTime()
  )
    return null;
  if (
    overviewWeek !== null &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(overviewWeek) ||
      shanghaiDayjs(overviewWeek).format("YYYY-MM-DD") !== overviewWeek ||
      !firstVisibleDate ||
      !lastVisibleDate ||
      overviewWeek < firstVisibleDate ||
      overviewWeek > lastVisibleDate)
  )
    return null;
  const source = getDemoWorkspacePage(identity, locale, "calendar");
  const pendingHomeworks = getDemoHomeworksTabData(
    locale,
  ).homeworkSummaries.filter(
    (homework) => homework.completionRequired && !homework.completion,
  );
  return {
    ...source,
    tab: "overview" as const,
    overviewWeek,
    mainContentLabel: source.copy.workspace.nav.overview.title,
    todos: getDemoTodos(locale),
    overview: {
      calendar,
      currentTermName: calendar.activeCalendarSemesterName ?? null,
      dueToday: pendingHomeworks.filter(
        (homework) =>
          homework.submissionDueAt &&
          shanghaiDayjs(homework.submissionDueAt).format("YYYY-MM-DD") ===
            calendar.todayDate,
      ),
      hasAnySelection: source.subscribedSectionCount > 0,
      hasCurrentTermSelection: true,
      overviewLinks: getDemoCatalogLinksData(locale).overviewLinks,
      pendingHomeworks,
      todaySessions: calendar.allSessions.filter(
        (session) => session.dateKey === calendar.todayDate,
      ),
    },
  };
}
