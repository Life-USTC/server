import { getNextDeparturesFromHubCampus } from "@/features/bus/server/bus-service";
import { listPublications } from "@/features/publications/server/publication-public-read-service";
import { readWeatherCache } from "@/features/weather/server/weather-cache";
import {
  WEATHER_LOCATIONS,
  type WeatherLocationKey,
} from "@/features/weather/server/weather-types";
import { formatMessage } from "@/features/workspace/lib/overview-formatters";
import { listYoungEvents } from "@/features/young/server/young-event-service";
import type { AppLocale } from "@/i18n/config";
import { logAppEvent } from "@/lib/log/app-logger";
import type { getAnonymousHomePageCopy } from "@/lib/shell/page-copy";
import { formatCampusDateTime } from "@/lib/time/campus-date";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

/**
 * `/` is the anonymous landing page and is excluded from shared HTML caching
 * (`DIRECT_REQUEST_PATHS` in `src/lib/cloudflare/public-ssr-gateway.ts`), so
 * every visit renders against the request clock. That is what lets the shuttle
 * board show real minutes-until-departure, as
 * `rendering-and-cache.cacheable-public-pages-11` requires of bus surfaces, and
 * it is why these reads must stay cheap: each one is on the critical path of a
 * cold landing request.
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

const NOTICE_LIMIT = 3;
const ACTIVITY_LIMIT = 3;
const BUS_DEPARTURE_LIMIT = 3;

export type HomeWeatherTile = {
  locationKey: WeatherLocationKey;
  temperature: string | null;
  condition: string;
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
  bus: HomeBusBoard | null;
  notices: HomeListItem[] | null;
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

async function readWeather(): Promise<HomeWeatherTile[]> {
  const tiles = await Promise.all(
    WEATHER_LOCATIONS.map(async (location) => {
      const snapshot = await readWeatherCache(location.key);
      if (!snapshot) return null;
      const temperature = snapshot.current.temperature;
      return {
        condition: snapshot.current.condition.text,
        locationKey: location.key,
        temperature: temperature == null ? null : `${Math.round(temperature)}°`,
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
    // From "now" rather than the start of today, so an activity that already
    // finished this morning does not sit at the top of "upcoming".
    dateFrom: shanghaiDayjs().toDate(),
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
  copy: ReturnType<typeof getAnonymousHomePageCopy>;
  locale: AppLocale;
  requestId: string | undefined;
}): Promise<AnonymousHomeInformation> {
  const { copy, locale, requestId } = input;
  const [weather, bus, notices, activities] = await Promise.all([
    readSection("weather", requestId, readWeather),
    readSection("bus", requestId, () => readBus(locale, copy)),
    readSection("notices", requestId, () => readNotices(locale)),
    readSection("activities", requestId, () => readActivities(locale)),
  ]);

  return { activities, bus, notices, weather };
}
