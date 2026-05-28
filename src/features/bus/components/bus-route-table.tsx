"use client";

import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Clock3,
  Route,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import type {
  BusApplicableRoute,
  BusApplicableTrip,
} from "@/features/bus/lib/bus-client";
import { cn } from "@/lib/utils";
import {
  BUS_ROUTE_TABLE_SHELL_CLASS,
  type BusTranslator,
  formatEtaHoursMinutes,
  formatStopTime,
  getNextUpcomingTripHighlightKey,
  getRouteSegmentStopColumns,
  getTripStopTimeForOrder,
} from "./bus-panel-shared";

function SummaryMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="min-w-0 border-border/70 border-b py-2 last:border-b-0 sm:border-b-0 sm:border-l sm:py-0 sm:pl-3 sm:first:border-l-0 sm:first:pl-0">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <p className="truncate text-[0.6875rem] text-muted-foreground uppercase leading-none tracking-[0.12em]">
          {label}
        </p>
      </div>
      <p className="mt-2 truncate font-semibold text-foreground text-sm">
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 truncate text-muted-foreground text-xs">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function getEarliestNextTrip(
  routes: BusApplicableRoute[],
): BusApplicableTrip | null {
  let bestTrip: BusApplicableTrip | null = null;
  let bestMinutes = Number.POSITIVE_INFINITY;

  for (const route of routes) {
    const nextTrip = route.nextTrip;
    if (!nextTrip) continue;

    const minutes =
      nextTrip.startTime.displayMinutes ?? Number.POSITIVE_INFINITY;
    if (minutes < bestMinutes) {
      bestTrip = nextTrip;
      bestMinutes = minutes;
    }
  }

  return bestTrip;
}

export function BusRouteTable({
  actions,
  dayType,
  endCampusName,
  footer,
  hideHeader = false,
  hideHeaderOnMobile = false,
  onReverse,
  routes,
  startCampusName,
  t,
}: {
  actions?: ReactNode;
  dayType: "weekday" | "weekend";
  endCampusName: string | null;
  footer?: ReactNode;
  hideHeader?: boolean;
  hideHeaderOnMobile?: boolean;
  onReverse?: () => void;
  routes: BusApplicableRoute[];
  startCampusName: string | null;
  t: BusTranslator;
}) {
  const nextTripHighlightKey = useMemo(
    () => getNextUpcomingTripHighlightKey(routes),
    [routes],
  );

  return (
    <div className={BUS_ROUTE_TABLE_SHELL_CLASS}>
      <div className="relative w-full" data-slot="table-container">
        {hideHeader ? null : (
          <BusRouteSummary
            actions={actions}
            className={cn(
              "border-zinc-950/10 border-b bg-[linear-gradient(135deg,rgba(244,246,248,0.92),rgba(255,255,255,0.72))] px-3 py-3 sm:px-4 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(39,39,42,0.74),rgba(9,9,11,0.56))]",
              hideHeaderOnMobile && "hidden xl:block",
            )}
            dayType={dayType}
            endCampusName={endCampusName}
            routes={routes}
            startCampusName={startCampusName}
            t={t}
          />
        )}

        {routes.length === 0 ? (
          <div className="py-8">
            <div className="flex flex-col items-center gap-4 border-border/70 border-y border-dashed px-4 py-9 text-center">
              <p className="max-w-lg text-muted-foreground text-sm leading-6">
                {t("planner.empty")}
              </p>
              {onReverse ? (
                <button
                  type="button"
                  onClick={onReverse}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 font-medium text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ArrowLeftRight aria-hidden="true" className="size-4" />
                  <span>{t("planner.emptyReverseAction")}</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {routes.map((route) => {
              const stopColumns = getRouteSegmentStopColumns(route);
              const tableMinWidth = `${Math.max(16, stopColumns.length * 4.25)}rem`;

              return (
                <section
                  key={`route-card-${route.route.id}`}
                  className="min-w-0 overflow-hidden border-border/70 border-b last:border-b-0"
                >
                  <h3 className="px-3 pt-3 pb-1 font-medium text-foreground text-sm leading-6 sm:px-4">
                    {route.route.descriptionPrimary}
                  </h3>
                  <div className="overflow-x-auto">
                    <table
                      className="w-full table-fixed caption-bottom border-separate border-spacing-0 text-sm"
                      style={{ minWidth: tableMinWidth }}
                    >
                      <caption className="sr-only">
                        {route.route.descriptionPrimary}
                      </caption>
                      <thead>
                        <tr className="border-border/70 border-b">
                          {stopColumns.map((col, index) => (
                            <th
                              key={`${route.route.id}-col-${col.stopOrder}`}
                              className={cn(
                                "h-auto min-w-[4.25rem] max-w-[7rem] px-3 py-2.5 align-bottom font-medium text-muted-foreground text-xs leading-tight sm:px-4",
                                index === 0
                                  ? "text-left"
                                  : index === stopColumns.length - 1
                                    ? "text-right"
                                    : "text-center",
                              )}
                              scope="col"
                            >
                              <span className="line-clamp-3">{col.label}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {route.visibleTrips.map((trip) => {
                          const tripKey = `${route.route.id}:${trip.trip.id}`;
                          const isNextHighlight =
                            nextTripHighlightKey != null &&
                            tripKey === nextTripHighlightKey;

                          return (
                            <tr
                              key={`trip-${route.route.id}-${trip.trip.id}`}
                              className={cn(
                                "border-border/60 border-b transition-colors last:border-b-0 hover:bg-muted/35",
                                trip.status === "departed" &&
                                  "text-muted-foreground opacity-70",
                                isNextHighlight &&
                                  "bg-muted/50 hover:bg-muted/60",
                              )}
                            >
                              {stopColumns.map((col, index) => {
                                const stopTime = getTripStopTimeForOrder(
                                  trip,
                                  col.stopOrder,
                                );
                                return (
                                  <td
                                    key={`${trip.trip.id}-stop-${col.stopOrder}`}
                                    className={cn(
                                      "px-3 py-3.5 align-middle sm:px-4",
                                      index === 0
                                        ? "ps-4 text-left sm:ps-5"
                                        : index === stopColumns.length - 1
                                          ? "pe-4 text-right sm:pe-5"
                                          : "text-center",
                                    )}
                                  >
                                    <p
                                      className={cn(
                                        "font-mono text-sm tabular-nums tracking-tight sm:text-[0.9375rem]",
                                        trip.status === "departed"
                                          ? "text-muted-foreground"
                                          : "text-foreground",
                                        stopTime.isEstimated &&
                                          trip.status !== "departed" &&
                                          "text-foreground/80",
                                      )}
                                    >
                                      {formatStopTime(stopTime)}
                                    </p>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      {footer ? (
        <div className="flex flex-col items-end gap-2 border-border/70 border-t py-3 text-right">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function BusRouteSummary({
  actions,
  bodyAligned = false,
  className,
  dayType,
  endCampusName,
  routes,
  startCampusName,
  t,
}: {
  actions?: ReactNode;
  bodyAligned?: boolean;
  className?: string;
  dayType: "weekday" | "weekend";
  endCampusName: string | null;
  routes: BusApplicableRoute[];
  startCampusName: string | null;
  t: BusTranslator;
}) {
  const nextTrip = useMemo(() => getEarliestNextTrip(routes), [routes]);
  const eta = nextTrip
    ? formatEtaHoursMinutes(nextTrip.minutesUntilStart, t)
    : null;
  const direction =
    startCampusName && endCampusName
      ? `${startCampusName} -> ${endCampusName}`
      : "-";

  if (bodyAligned) {
    return (
      <div className={className} data-slot="bus-table-actions">
        <div className="grid min-w-0 gap-3 xl:grid-cols-[22.5rem_minmax(0,1fr)] xl:items-stretch xl:gap-4">
          <div className="grid min-w-0 grid-cols-2 gap-2 p-3">
            <SummaryMetric
              icon={<Clock3 className="size-3.5" />}
              label={t("nextDeparture")}
              value={
                nextTrip
                  ? formatStopTime(nextTrip.startTime)
                  : t("noMoreBusToday")
              }
              detail={nextTrip ? (eta ?? t("planner.etaUnknown")) : undefined}
            />
            <SummaryMetric
              icon={<ArrowRight className="size-3.5" />}
              label={t("planner.direction")}
              value={direction}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 border-zinc-950/10 border-t p-3 sm:flex-row sm:items-stretch xl:border-t-0 xl:border-l dark:border-white/10">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <SummaryMetric
                icon={<CalendarDays className="size-3.5" />}
                label={t("query.dayType")}
                value={t(`dayType.${dayType}`)}
              />
              <SummaryMetric
                icon={<Route className="size-3.5" />}
                label={t("planner.routes")}
                value={t("planner.routeSectionsCount", {
                  count: routes.length,
                })}
              />
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end xl:min-w-[16.5rem]">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-slot="bus-table-actions">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
          <SummaryMetric
            icon={<Clock3 className="size-3.5" />}
            label={t("nextDeparture")}
            value={
              nextTrip
                ? formatStopTime(nextTrip.startTime)
                : t("noMoreBusToday")
            }
            detail={nextTrip ? (eta ?? t("planner.etaUnknown")) : undefined}
          />
          <SummaryMetric
            icon={<ArrowRight className="size-3.5" />}
            label={t("planner.direction")}
            value={direction}
          />
          <SummaryMetric
            icon={<CalendarDays className="size-3.5" />}
            label={t("query.dayType")}
            value={t(`dayType.${dayType}`)}
          />
          <SummaryMetric
            icon={<Route className="size-3.5" />}
            label={t("planner.routes")}
            value={t("planner.routeSectionsCount", {
              count: routes.length,
            })}
          />
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
