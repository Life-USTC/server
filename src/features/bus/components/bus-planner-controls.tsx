"use client";

import {
  ArrowLeftRight,
  Eye,
  EyeOff,
  Map as MapIcon,
  MapPin,
} from "lucide-react";
import {
  DashboardTabToolbarGroup,
  dashboardTabToolbarItemClass,
} from "@/components/filters/dashboard-tab-toolbar";
import { Card } from "@/components/ui/card";
import type { BusTimetableData } from "@/features/bus/lib/bus-types";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

function PlannerDayTypePills({
  value,
  onChange,
  t,
}: {
  value: "weekday" | "weekend";
  onChange: (value: "weekday" | "weekend") => void;
  t: (key: string) => string;
}) {
  return (
    <DashboardTabToolbarGroup className="border-0 bg-muted/35 p-0.5">
      {(["weekday", "weekend"] as const).map((dayType) => (
        <button
          key={dayType}
          type="button"
          aria-pressed={value === dayType}
          onClick={() => onChange(dayType)}
          className={cn(
            dashboardTabToolbarItemClass(value === dayType),
            "min-h-8 rounded-md px-3 font-medium text-sm shadow-none",
            value === dayType && "bg-foreground text-background",
          )}
        >
          {t(`dayType.${dayType}`)}
        </button>
      ))}
    </DashboardTabToolbarGroup>
  );
}

function StopPicker({
  testId,
  label,
  campuses,
  selectedId,
  onSelect,
}: {
  testId: string;
  label: string;
  campuses: BusTimetableData["campuses"];
  selectedId: number | null;
  onSelect: (campusId: number) => void;
}) {
  return (
    <section className="min-w-0 space-y-2">
      <p className="font-medium text-foreground text-sm">{label}</p>
      <fieldset data-testid={testId} className="grid">
        <legend className="sr-only">{label}</legend>
        {campuses.map((campus) => {
          const isSelected = selectedId === campus.id;
          return (
            <button
              key={campus.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(campus.id)}
              className={cn(
                "group flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 px-1 py-2.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isSelected
                  ? "bg-muted/45 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    isSelected
                      ? "bg-background text-foreground"
                      : "bg-muted/45 text-muted-foreground",
                  )}
                >
                  <MapPin className="size-3.5" />
                </span>
                <span className="truncate text-sm">{campus.namePrimary}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-full transition-colors",
                  isSelected
                    ? "bg-foreground"
                    : "bg-muted-foreground/25 group-hover:bg-muted-foreground/45",
                )}
              />
            </button>
          );
        })}
      </fieldset>
    </section>
  );
}

export function BusPlannerControls({
  data,
  endCampusId,
  handleSwap,
  markDirty,
  setEndCampusId,
  setStartCampusId,
  startCampusId,
  t,
}: {
  data: BusTimetableData;
  endCampusId: number | null;
  handleSwap: () => void;
  markDirty: () => void;
  setEndCampusId: (value: number | null) => void;
  setStartCampusId: (value: number | null) => void;
  startCampusId: number | null;
  t: (key: string) => string;
}) {
  return (
    <section className="min-w-0 py-4">
      <Card className="gap-0 rounded-lg border-border/60 bg-card/80 px-3 py-3">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] sm:gap-4">
          <StopPicker
            testId="bus-start-stop-group"
            label={t("planner.start")}
            campuses={data.campuses}
            selectedId={startCampusId}
            onSelect={(campusId) => {
              markDirty();
              if (endCampusId != null && campusId === endCampusId) {
                setEndCampusId(startCampusId);
                setStartCampusId(campusId);
              } else {
                setStartCampusId(campusId);
              }
            }}
          />

          <div className="flex items-start justify-center pt-8">
            <button
              type="button"
              onClick={handleSwap}
              className={cn(
                dashboardTabToolbarItemClass(
                  false,
                  "inline-flex size-9 items-center justify-center rounded-md bg-muted/35 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:size-10",
                ),
              )}
              aria-label={t("planner.reverse")}
            >
              <ArrowLeftRight aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{t("planner.reverse")}</span>
            </button>
          </div>

          <StopPicker
            testId="bus-end-stop-group"
            label={t("planner.end")}
            campuses={data.campuses}
            selectedId={endCampusId}
            onSelect={(campusId) => {
              markDirty();
              if (startCampusId != null && campusId === startCampusId) {
                setStartCampusId(endCampusId);
                setEndCampusId(campusId);
              } else {
                setEndCampusId(campusId);
              }
            }}
          />
        </div>
      </Card>
    </section>
  );
}

export function BusPlannerSettings({
  markDirty,
  selectedDayType,
  setSelectedDayType,
  setShowDepartedTrips,
  showDepartedTrips,
  t,
}: {
  markDirty: () => void;
  selectedDayType: "weekday" | "weekend";
  setSelectedDayType: (value: "weekday" | "weekend") => void;
  setShowDepartedTrips: (updater: (value: boolean) => boolean) => void;
  showDepartedTrips: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
      <PlannerDayTypePills
        value={selectedDayType}
        onChange={setSelectedDayType}
        t={t}
      />
      <button
        type="button"
        onClick={() => {
          markDirty();
          setShowDepartedTrips((value) => !value);
        }}
        className={cn(
          "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          showDepartedTrips
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "bg-muted/35 text-foreground hover:bg-muted",
        )}
        aria-pressed={showDepartedTrips}
        aria-label={t("query.showDepartedTrips")}
      >
        {showDepartedTrips ? (
          <Eye aria-hidden="true" className="h-4 w-4" />
        ) : (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        )}
        <span>{t("query.showDepartedTrips")}</span>
      </button>
      <Link
        href="/bus-map"
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-muted/35 px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <MapIcon aria-hidden="true" className="h-4 w-4" />
        <span>{t("transitMap")}</span>
      </Link>
    </div>
  );
}
