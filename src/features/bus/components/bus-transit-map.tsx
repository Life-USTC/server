"use client";

import { ArrowLeft, Bus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  BUS_H,
  BUS_W,
  buildRoutePoints,
  computeBusTransform,
  computeOffsets,
  hhmmToMin,
  labelOffset,
  layoutCampuses,
  NODE_R,
  type Pos,
  pointsToPath,
  REFRESH_MS,
  routeColor,
  SVG_H,
  SVG_W,
} from "@/features/bus/components/bus-transit-map-layout";
import type { BusMapData } from "@/features/bus/lib/bus-types";
import { cn } from "@/lib/utils";

const REFRESH_SPINNER_HIDE_DELAY_MS = 800;
/* ------------------------------------------------------------------ */

function BusIcon({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <>
      <rect
        x={-BUS_W / 2}
        y={-BUS_H / 2}
        width={BUS_W}
        height={BUS_H}
        rx={2.5}
        fill={color}
        opacity={opacity}
      />
      {/* Windshield */}
      <rect
        x={BUS_W / 2 - 5.5}
        y={-BUS_H / 2 + 2}
        width={4}
        height={BUS_H - 4}
        rx={1}
        fill="white"
        opacity={0.85}
      />
      {/* Headlights */}
      <circle
        cx={BUS_W / 2 - 1}
        cy={-BUS_H / 2 + 2}
        r={1}
        fill="white"
        opacity={0.6}
      />
      <circle
        cx={BUS_W / 2 - 1}
        cy={BUS_H / 2 - 2}
        r={1}
        fill="white"
        opacity={0.6}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BusTransitMap({ data }: { data: BusMapData | null }) {
  const t = useTranslations("busMap");
  const tBus = useTranslations("bus");
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredRoute, setHoveredRoute] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), REFRESH_SPINNER_HIDE_DELAY_MS);
  }, [router]);

  const positions = useMemo(
    () => (data ? layoutCampuses(data.campuses) : new Map<number, Pos>()),
    [data],
  );
  const allRouteIds = useMemo(
    () => (data ? data.routes.map((r) => r.routeId) : []),
    [data],
  );
  const offsets = useMemo(
    () => (data ? computeOffsets(data.routes) : new Map()),
    [data],
  );
  const routePaths = useMemo(() => {
    if (!data) return new Map<number, { points: Pos[]; d: string }>();
    const map = new Map<number, { points: Pos[]; d: string }>();
    for (const route of data.routes) {
      const points = buildRoutePoints(route, positions, offsets);
      map.set(route.routeId, { points, d: pointsToPath(points) });
    }
    return map;
  }, [data, positions, offsets]);

  const activeRouteIds = useMemo(() => {
    if (!data) return new Set<number>();
    return new Set(data.activeTrips.map((tr) => tr.routeId));
  }, [data]);

  /* ---- Empty state ---- */
  if (!data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <Bus className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground">{t("noData")}</p>
        <Link href="/?tab=bus" className="text-primary text-sm hover:underline">
          {t("backToBus")}
        </Link>
      </div>
    );
  }

  const enRoute = data.activeTrips.filter((tr) => tr.status === "en-route");
  const departingSoon = data.activeTrips.filter(
    (tr) => tr.status === "departing-soon",
  );
  const nowMin = (() => {
    const d = new Date(data.now);
    return d.getHours() * 60 + d.getMinutes();
  })();
  const totalTripsToday = data.routes.reduce(
    (s, r) =>
      s + (data.todayType === "weekday" ? r.weekdayTrips : r.weekendTrips),
    0,
  );

  // Group departing-soon trips by campus for staggering
  const depByCampus = new Map<number, typeof departingSoon>();
  for (const trip of departingSoon) {
    const route = data.routes.find((r) => r.routeId === trip.routeId);
    if (!route || route.stops.length === 0) continue;
    const cId = route.stops[0].campusId;
    const list = depByCampus.get(cId) ?? [];
    list.push(trip);
    depByCampus.set(cId, list);
  }

  return (
    <main className="page-main flex flex-col gap-4">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/?tab=bus"
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToBus")}
        </Link>
        <div className="flex-1" />
        <Badge
          variant="outline"
          className="font-semibold text-[10px] uppercase tracking-widest"
        >
          {t("experimental")}
        </Badge>
      </div>

      <div className="mb-2 flex items-end gap-3">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-muted-foreground text-xs transition-all hover:bg-card hover:text-foreground"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
        </button>
      </div>

      {/* Map + Sidebar */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* SVG transit map */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="h-auto w-full"
            style={{ minHeight: 280 }}
            onMouseLeave={() => setHoveredRoute(null)}
          >
            <title>{t("title")}</title>
            <defs>
              <filter id="bus-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <style>{`
                @keyframes dash-march {
                  to { stroke-dashoffset: -12; }
                }
              `}</style>
            </defs>

            {/* Background track-bed lines (wide, muted) */}
            {data.routes.map((route) => {
              const pathData = routePaths.get(route.routeId);
              if (!pathData?.d) return null;
              return (
                <path
                  key={`bg-${route.routeId}`}
                  d={pathData.d}
                  stroke={routeColor(route.routeId, allRouteIds)}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={hoveredRoute === route.routeId ? 0.2 : 0.06}
                  style={{ transition: "opacity 0.2s" }}
                />
              );
            })}

            {/* Main route polylines */}
            {data.routes.map((route) => {
              const pathData = routePaths.get(route.routeId);
              if (!pathData?.d) return null;
              const color = routeColor(route.routeId, allRouteIds);
              const isActive = activeRouteIds.has(route.routeId);
              const isHovered = hoveredRoute === route.routeId;

              return (
                <path
                  key={`route-${route.routeId}`}
                  d={pathData.d}
                  stroke={color}
                  strokeWidth={isHovered ? 4.5 : 3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={hoveredRoute != null && !isHovered ? 0.25 : 0.85}
                  style={{
                    transition: "opacity 0.2s, stroke-width 0.15s",
                    ...(isActive
                      ? {
                          strokeDasharray: "8 4",
                          animation: "dash-march 0.8s linear infinite",
                        }
                      : {}),
                  }}
                />
              );
            })}

            {/* En-route bus icons */}
            {enRoute.map((trip) => {
              const route = data.routes.find((r) => r.routeId === trip.routeId);
              if (!route) return null;
              const transform = computeBusTransform(
                trip,
                route,
                positions,
                offsets,
              );
              if (!transform) return null;
              const color = routeColor(trip.routeId, allRouteIds);

              return (
                <g
                  key={`bus-${trip.tripId}`}
                  transform={`translate(${transform.x.toFixed(1)},${transform.y.toFixed(1)}) rotate(${transform.angle.toFixed(1)})`}
                  filter="url(#bus-glow)"
                >
                  <BusIcon color={color} />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0; 0,-1.5; 0,0"
                    dur="2s"
                    repeatCount="indefinite"
                    additive="sum"
                  />
                </g>
              );
            })}

            {/* Departing-soon: bus at departure station with pulsing ring */}
            {departingSoon.map((trip) => {
              const route = data.routes.find((r) => r.routeId === trip.routeId);
              if (!route || route.stops.length === 0) return null;
              const campusId = route.stops[0].campusId;
              const pos = positions.get(campusId);
              if (!pos) return null;
              const color = routeColor(trip.routeId, allRouteIds);

              // Stagger multiple departing buses at same station
              const siblings = depByCampus.get(campusId) ?? [];
              const idx = siblings.indexOf(trip);
              const total = siblings.length;
              const spreadAngle = total > 1 ? (Math.PI * 0.6) / (total - 1) : 0;
              const baseAngle = -Math.PI / 2 - (spreadAngle * (total - 1)) / 2;
              const sAngle = baseAngle + idx * spreadAngle;
              const staggerR = NODE_R + 14;
              const bx = pos.x + Math.cos(sAngle) * staggerR;
              const by = pos.y + Math.sin(sAngle) * staggerR;

              // Point bus toward first destination
              const nextStop = route.stops[1];
              const nextPos = nextStop
                ? positions.get(nextStop.campusId)
                : null;
              const busAngle = nextPos
                ? Math.atan2(nextPos.y - pos.y, nextPos.x - pos.x) *
                  (180 / Math.PI)
                : 0;

              return (
                <g key={`dep-${trip.tripId}`}>
                  <circle
                    cx={bx}
                    cy={by}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                  >
                    <animate
                      attributeName="r"
                      values={`${BUS_W / 2 + 2};${BUS_W / 2 + 12};${BUS_W / 2 + 2}`}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0.05;0.6"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <g
                    transform={`translate(${bx.toFixed(1)},${by.toFixed(1)}) rotate(${busAngle.toFixed(1)})`}
                  >
                    <BusIcon color={color} opacity={0.85} />
                  </g>
                </g>
              );
            })}

            {/* Campus nodes (drawn on top of route lines) */}
            {data.campuses.map((campus) => {
              const pos = positions.get(campus.id);
              if (!pos) return null;
              const lbl = labelOffset(pos, campus.namePrimary);
              const routeCount = data.routes.filter((r) =>
                r.stops.some((s) => s.campusId === campus.id),
              ).length;
              return (
                <g key={campus.id}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={NODE_R}
                    className="fill-card stroke-border"
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={NODE_R - 4}
                    fill="none"
                    className="stroke-foreground"
                    strokeWidth={1.5}
                    opacity={routeCount > 3 ? 0.55 : 0.25}
                  />
                  <text
                    x={pos.x + lbl.dx}
                    y={pos.y + lbl.dy}
                    textAnchor={lbl.textAnchor}
                    className="hidden fill-foreground font-semibold text-[13px] sm:block"
                    style={{
                      fontFamily: "system-ui, sans-serif",
                      paintOrder: "stroke",
                      stroke: "hsl(var(--card))",
                      strokeLinejoin: "round",
                      strokeWidth: 5,
                    }}
                  >
                    {campus.namePrimary}
                  </text>
                  {campus.nameSecondary && (
                    <text
                      x={pos.x + lbl.dx}
                      y={pos.y + lbl.dy + 15}
                      textAnchor={lbl.textAnchor}
                      className="hidden fill-muted-foreground text-[10px] sm:block"
                      style={{
                        fontFamily: "system-ui, sans-serif",
                        paintOrder: "stroke",
                        stroke: "hsl(var(--card))",
                        strokeLinejoin: "round",
                        strokeWidth: 4,
                      }}
                    >
                      {campus.nameSecondary}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="rounded-xl border border-border/60 bg-card/80 p-4">
            <h3 className="mb-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
              {t("legend.title")}
            </h3>
            <ul className="space-y-1.5">
              {data.routes.map((route) => {
                const color = routeColor(route.routeId, allRouteIds);
                const isHovered = hoveredRoute === route.routeId;
                return (
                  <li key={route.routeId}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isHovered && "bg-accent",
                      )}
                      onMouseEnter={() => setHoveredRoute(route.routeId)}
                      onMouseLeave={() => setHoveredRoute(null)}
                      onFocus={() => setHoveredRoute(route.routeId)}
                      onBlur={() => setHoveredRoute(null)}
                    >
                      <span
                        className="h-2 w-6 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate text-xs">
                        {route.descriptionPrimary}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 space-y-1.5 border-border/40 border-t pt-3 text-muted-foreground text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                </span>
                {t("legend.enRoute")}
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-pulse rounded-full border border-amber-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 translate-x-0.5 translate-y-0.5 rounded-full bg-amber-400" />
                </span>
                {t("legend.departingSoon")}
              </div>
            </div>
          </div>

          {/* Active trips */}
          <div className="rounded-xl border border-border/60 bg-card/80 p-4">
            <h3 className="mb-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
              {data.activeTrips.length > 0
                ? `${enRoute.length} ${t("legend.enRoute")} · ${departingSoon.length} ${t("legend.departingSoon")}`
                : t("status.noActive")}
            </h3>
            {data.activeTrips.length === 0 ? (
              <p className="text-muted-foreground/50 text-xs">
                {t("status.noActive")}
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {data.activeTrips.map((trip) => {
                  const route = data.routes.find(
                    (r) => r.routeId === trip.routeId,
                  );
                  const color = routeColor(trip.routeId, allRouteIds);
                  const depMin = hhmmToMin(trip.departureTime);
                  const etaLabel =
                    trip.status === "departing-soon" && depMin != null
                      ? t("status.departingSoon", {
                          minutes: Math.max(0, depMin - nowMin),
                        })
                      : t("status.enRoute");

                  return (
                    <li key={trip.tripId}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          hoveredRoute === trip.routeId && "bg-accent/50",
                        )}
                        onMouseEnter={() => setHoveredRoute(trip.routeId)}
                        onMouseLeave={() => setHoveredRoute(null)}
                        onFocus={() => setHoveredRoute(trip.routeId)}
                        onBlur={() => setHoveredRoute(null)}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-xs">
                            {route?.descriptionPrimary ??
                              `Route ${trip.routeId}`}
                          </span>
                          <span className="block font-mono text-[10px] text-muted-foreground tabular-nums">
                            {trip.departureTime} → {trip.arrivalTime}
                          </span>
                        </span>
                        <Badge
                          variant={
                            trip.status === "en-route" ? "default" : "outline"
                          }
                          className="shrink-0 text-[10px]"
                        >
                          {etaLabel}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Day type + stats */}
          <div className="rounded-xl border border-border/60 bg-card/80 p-4 text-muted-foreground text-xs">
            <p className="font-medium">
              {tBus(`dayType.${data.todayType}`)} ·{" "}
              <span className="font-mono tabular-nums">
                {new Date(data.now).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
            <p className="mt-1">
              {t(`tripCount.${data.todayType}`, { count: totalTripsToday })}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
