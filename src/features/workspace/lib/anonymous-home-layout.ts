/**
 * Shared between the anonymous home loader and its component, so the number of
 * rows the server sends and the number a narrow viewport shows cannot drift.
 *
 * The page ships one payload for every viewport — the anonymous landing
 * representation has to stay viewer-independent
 * (`rendering-and-cache.web-rendering-and-cache-1`) — so the extra rows are in
 * the HTML everywhere and the `lg` breakpoint decides whether they are shown.
 *
 * This file is imported by a client component; keep it free of server imports.
 */

/** Rows every viewport shows. Later rows are revealed from `lg` up. */
export const HOME_COMPACT_ITEM_COUNT = 3;

/** Notices and activities fetched for the wide layout. */
export const HOME_LIST_LIMIT = 5;

/** Shuttle departures fetched for the wide layout. */
export const HOME_BUS_DEPARTURE_LIMIT = 5;

/** Hours of the weather trend shipped for the wide layout. */
export const HOME_WEATHER_HOURLY_LIMIT = 3;
