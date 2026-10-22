import { getNextDeparturesFromHubCampus } from "@/features/bus/server/bus-service";
import { listPublications } from "@/features/publications/server/publication-public-read-service";
import { readWeatherCache } from "@/features/weather/server/weather-cache";
import {
  WEATHER_LOCATIONS,
  type WeatherLocationKey,
} from "@/features/weather/server/weather-types";
import {
  HOME_BUS_DEPARTURE_LIMIT,
  HOME_LIST_LIMIT,
  HOME_WEATHER_HOURLY_LIMIT,
} from "@/features/workspace/lib/anonymous-home-layout";
import { formatMessage } from "@/features/workspace/lib/overview-formatters";
import { listYoungEvents } from "@/features/young/server/young-event-service";
import type { AppLocale } from "@/i18n/config";
import { logAppEvent } from "@/lib/log/app-logger";
import type { getAnonymousHomePageCopy } from "@/lib/shell/page-copy";
import { formatCampusDateTime } from "@/lib/time/campus-date";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

/**
 * `/` is the one home for every visitor and is admitted to shared HTML caching
 * (`STATIC_PUBLIC_PATHS` in `src/lib/cloudflare/public-ssr-gateway.ts`). The
 * server render must therefore depend on neither the viewer nor the clock, so
 * only the editorial sections live here: notices, and the activities for the
 * current Shanghai day. The shuttle board and weather change by the minute and
 * are read by the client from `HOME_CAMPUS_NOW_PATH` instead, which is what
 * lets the board keep the real minutes-until-departure that
 * `rendering-and-cache.cacheable-public-pages-11` requires of bus surfaces
 * while the rest of the page is served from cache.
 *
 * These reads are still on the critical path of a cache miss, so they must
 * stay cheap.
 *
 * The sections are read in parallel and each is isolated behind the budget. A
 * read that throws or overruns resolves to `null`, that section renders its
 * "unavailable" copy, and the rest of the page is unaffected — so no single
 * upstream can blank or stall the landing page.
 *
 * Every section here reads PostgreSQL, KV or a process cache and nothing else.
 * In particular weather is deliberately cache-only: `getWeatherSnapshot` would
 * fall through to AMap/Open-Meteo on a stale entry and then write back to the
 * cache and the history table, which is cron work, not landing-page work. The
 * 20- and 30-minute weather crons keep the entry warm within its one-hour
 * expiry; a genuinely cold entry degrades to the unavailable card instead of
 * putting a provider round trip in front of every anonymous visitor.
 */
const SECTION_BUDGET_MS = 1_500;

/**
 * Desktop reads these sections on a canvas twice the width of a phone, so the
 * page fetches the longer list and the component's breakpoint decides how much
 * of it is shown (`src/features/workspace/lib/anonymous-home-layout.ts`). The
 * extra rows cost one larger `take` on queries that already run; they add no
 * round trip to the landing path.
 */
const NOTICE_LIMIT = HOME_LIST_LIMIT;
const ACTIVITY_LIMIT = HOME_LIST_LIMIT;
const BUS_DEPARTURE_LIMIT = HOME_BUS_DEPARTURE_LIMIT;

export type HomeWeatherHour = {
  key: string;
  label: string;
  temperature: string;
};

export type HomeWeatherTile = {
  locationKey: WeatherLocationKey;
  temperature: string | null;
  condition: string;
  /** Today's high/low, already formatted; `null` when the day is missing. */
  rangeLabel: string | null;
  hourly: HomeWeatherHour[];
};

export type HomeBusDeparture = {
  key: string;
  destination: string;
  departureTime: string;
  relativeLabel: string;
};

export type HomeBusBoard = {
  departures: HomeBusDeparture[];
  emptyNote: string;
  originNote: string;
};

export type HomeListItem = {
  key: string;
  href: string;
  title: string;
  meta: string | null;
  dateLabel: string | null;
};

/**
 * `null` means the section could not be read and renders as unavailable; an
 * empty list means it was read successfully and has nothing to show. The
 * component tells those apart, so a down upstream never looks like quiet news.
 */
export type AnonymousHomeInformation = {
  activities: HomeListItem[] | null;
  notices: HomeListItem[] | null;
};

/** Clock-driven half of the home page, read by the client on every visit. */
export type HomeCampusNow = {
  bus: HomeBusBoard | null;
  weather: HomeWeatherTile[] | null;
};

function withBudget<T>(work: Promise<T>, budgetMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("home section exceeded its budget")),
      budgetMs,
    );
  });
  return Promise.race([work, budget]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function readSection<T>(
  section: string,
  requestId: string | undefined,
  read: () => Promise<T>,
  budgetMs = SECTION_BUDGET_MS,
): Promise<T | null> {
  try {
    return await withBudget(read(), budgetMs);
  } catch (error) {
    logAppEvent("warn", "home.section.degraded", {
      event: "home.section.degraded",
      reason: error instanceof Error ? error.message : "unknown",
      requestId,
      section,
    });
    return null;
  }
}

function formatDegrees(value: number | null | undefined): string | null {
  return value == null ? null : `${Math.round(value)}°`;
}

/**
 * The cached snapshot already carries today's range and the hourly trend, so
 * the wide layout gets more weather out of the same KV read rather than a
 * second one.
 */
async function readWeather(
  copy: ReturnType<typeof getAnonymousHomePageCopy>,
): Promise<HomeWeatherTile[]> {
  const campusNow = copy.homepage.information.campusNow;
  const now = shanghaiDayjs();
  const todayKey = now.format("YYYY-MM-DD");
  const tiles = await Promise.all(
    WEATHER_LOCATIONS.map(async (location) => {
      const snapshot = await readWeatherCache(location.key);
      if (!snapshot) return null;
      const daily = snapshot.daily ?? [];
      const today =
        daily.find((day) => day.date.slice(0, 10) === todayKey) ?? daily.at(0);
      const high = formatDegrees(today?.temperatureHigh);
      const low = formatDegrees(today?.temperatureLow);
      return {
        condition: snapshot.current.condition.text,
        hourly: (snapshot.hourly ?? [])
          .filter((hour) => shanghaiDayjs(hour.at).isAfter(now))
          .slice(0, HOME_WEATHER_HOURLY_LIMIT)
          .flatMap((hour) => {
            const temperature = formatDegrees(hour.temperature);
            if (!temperature) return [];
            return [
              {
                key: hour.at,
                label: shanghaiDayjs(hour.at).format("HH:mm"),
                temperature,
              },
            ];
          }),
        locationKey: location.key,
        rangeLabel:
          high && low
            ? formatMessage(campusNow.weatherRange, { high, low })
            : null,
        temperature: formatDegrees(snapshot.current.temperature),
      } satisfies HomeWeatherTile;
    }),
  );
  return tiles.filter((tile): tile is HomeWeatherTile => tile != null);
}

async function readBus(
  locale: AppLocale,
  copy: ReturnType<typeof getAnonymousHomePageCopy>,
): Promise<HomeBusBoard | null> {
  const board = await getNextDeparturesFromHubCampus({
    limit: BUS_DEPARTURE_LIMIT,
    locale,
  });
  if (!board) return null;

  const campusNow = copy.homepage.information.campusNow;
  const originCampus = board.originCampus.namePrimary;
  return {
    departures: board.departures.flatMap((departure) => {
      const destination = departure.destinationCampus?.namePrimary;
      if (!destination || !departure.departureTime) return [];
      const minutes = departure.minutesUntilDeparture;
      return [
        {
          departureTime: departure.departureTime,
          destination,
          // One trip can be the soonest departure for several campuses it
          // calls at, so the trip id alone is not unique across the board.
          key: `${departure.tripId}-${departure.destinationCampus?.id}`,
          relativeLabel:
            minutes == null || minutes <= 0
              ? campusNow.busDepartingNow
              : formatMessage(campusNow.busMinutes, { minutes }),
        },
      ];
    }),
    emptyNote: formatMessage(campusNow.busEmpty, { campus: originCampus }),
    originNote: formatMessage(campusNow.busOriginNote, {
      campus: originCampus,
    }),
  };
}

async function readNotices(locale: AppLocale): Promise<HomeListItem[]> {
  const { data } = await listPublications({
    pagination: { page: 1, pageSize: NOTICE_LIMIT },
  });
  return data.map((item) => ({
    dateLabel: item.revision.publishedAt
      ? formatCampusDateTime(item.revision.publishedAt, "", locale, {
          dateStyle: "short",
          timeStyle: undefined,
        })
      : null,
    href: `/news/${item.id}`,
    key: item.id,
    meta: item.source.name,
    title: item.revision.title,
  }));
}

async function readActivities(locale: AppLocale): Promise<HomeListItem[]> {
  const { data } = await listYoungEvents({
    active: true,
    // The start of the Shanghai day rather than "now": `/` is cached until the
    // next midnight, so selecting from the request instant would freeze one
    // visitor's "upcoming" into every later visitor's page. Activities that
    // already finished earlier today stay in the list for the rest of the day.
    dateFrom: shanghaiDayjs().startOf("day").toDate(),
    page: 1,
    pageSize: ACTIVITY_LIMIT,
    timeBasis: "activity",
  });
  return data.map((event) => ({
    dateLabel: event.startAt
      ? formatCampusDateTime(event.startAt, "", locale, {
          dateStyle: "short",
          timeStyle: "short",
        })
      : null,
    href: `/catalog/young-events/${event.youngId}`,
    key: event.youngId,
    meta: event.location ?? event.organizer,
    title: event.name,
  }));
}

export async function loadAnonymousHomeInformation(input: {
  locale: AppLocale;
  requestId: string | undefined;
}): Promise<AnonymousHomeInformation> {
  const { locale, requestId } = input;
  const [notices, activities] = await Promise.all([
    readSection("notices", requestId, () => readNotices(locale)),
    readSection("activities", requestId, () => readActivities(locale)),
  ]);

  return { activities, notices };
}

export async function loadHomeCampusNow(input: {
  copy: ReturnType<typeof getAnonymousHomePageCopy>;
  locale: AppLocale;
  requestId: string | undefined;
}): Promise<HomeCampusNow> {
  const { copy, locale, requestId } = input;
  const [weather, bus] = await Promise.all([
    readSection("weather", requestId, () => readWeather(copy)),
    readSection("bus", requestId, () => readBus(locale, copy)),
  ]);

  return { bus, weather };
}
