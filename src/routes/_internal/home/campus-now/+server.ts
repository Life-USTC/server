import {
  type HomeCampusNow,
  loadHomeCampusNow,
} from "@/features/workspace/server/anonymous-home-sections";
import { getAnonymousHomePageCopy } from "@/features/workspace/server/workspace-page-copy";
import { logRouteFailure } from "@/lib/log/app-logger";
import type { RequestHandler } from "./$types";

/**
 * The minute-by-minute half of `/`: the shuttle board and the weather tiles.
 *
 * `/`'s HTML is viewer-independent and served from the shared public cache, so
 * it cannot carry a departure board whose labels are "3 分钟后". This endpoint
 * keeps that board on the request clock — which is what
 * `rendering-and-cache.cacheable-public-pages-11` asks of bus surfaces — while
 * the directory, notices and activities around it stay cacheable.
 *
 * The payload is public campus data and contains no viewer state, but it is
 * never stored: a board reused for even a minute would show departures that
 * have already left.
 */
const NO_STORE_HEADERS = {
  "Cache-Control": "public, max-age=0, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Accept-Language",
} as const;

function json(payload: HomeCampusNow, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: NO_STORE_HEADERS,
    status,
  });
}

export const GET: RequestHandler = async ({ locals }) => {
  const locale = locals.locale;
  try {
    return json(
      await loadHomeCampusNow({
        copy: getAnonymousHomePageCopy(locale),
        locale,
        requestId: locals.requestId,
      }),
    );
  } catch (error) {
    logRouteFailure("Failed to load home campus information", 500, error, {
      source: "web-home-campus-now",
    });
    // Each section already degrades to null on its own; this is the belt-and-
    // braces case where the whole read failed, and the card renders its
    // unavailable copy rather than the page failing.
    return json({ bus: null, weather: null });
  }
};

export const fallback: RequestHandler = () =>
  new Response(JSON.stringify({ error: "Method not allowed" }), {
    headers: { ...NO_STORE_HEADERS, Allow: "GET" },
    status: 405,
  });
