"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  getApplicableBusRoutes,
  getDefaultBusSelection,
  resolveClientBusDayType,
} from "@/features/bus/lib/bus-client";
import type { BusTimetableData } from "@/features/bus/lib/bus-types";
import { extractApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { AUTO_SAVE_DELAY_MS } from "./bus-panel-shared";
import { BusPlannerControls, BusPlannerSettings } from "./bus-planner-controls";
import { BusRouteTable } from "./bus-route-table";

type BusPanelProps = {
  data: BusTimetableData;
  signedIn?: boolean;
  showPreferences?: boolean;
  className?: string;
};

export function BusPanel({
  data,
  signedIn = false,
  showPreferences = false,
  className,
}: BusPanelProps) {
  const t = useTranslations("bus");
  const [, startTransition] = useTransition();
  const defaultSelection = useMemo(
    () => getDefaultBusSelection(data, data.preferences),
    [data],
  );

  const [selectedDayType, setSelectedDayType] = useState<"weekday" | "weekend">(
    "weekday",
  );
  const [startCampusId, setStartCampusId] = useState<number | null>(
    defaultSelection.startCampusId,
  );
  const [endCampusId, setEndCampusId] = useState<number | null>(
    defaultSelection.endCampusId,
  );
  const [showDepartedTrips, setShowDepartedTrips] = useState(
    data.preferences?.showDepartedTrips ?? false,
  );
  const [now, setNow] = useState(() => new Date());
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const saveGenerationRef = useRef(0);

  useEffect(() => {
    setSelectedDayType(resolveClientBusDayType(new Date()));
    setNow(new Date());

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const applicableRoutes = useMemo(
    () =>
      getApplicableBusRoutes({
        data,
        dayType: selectedDayType,
        startCampusId,
        endCampusId,
        showDepartedTrips,
        now,
      }),
    [data, selectedDayType, startCampusId, endCampusId, showDepartedTrips, now],
  );
  const startCampus = useMemo(
    () => data.campuses.find((campus) => campus.id === startCampusId) ?? null,
    [data.campuses, startCampusId],
  );
  const endCampus = useMemo(
    () => data.campuses.find((campus) => campus.id === endCampusId) ?? null,
    [data.campuses, endCampusId],
  );

  const showPlannerEstimatedHint = useMemo(() => {
    const inVisibleRows = applicableRoutes.some((route) =>
      route.visibleTrips.some((trip) =>
        trip.stopTimes.some((stopTime) => stopTime.isEstimated),
      ),
    );
    if (inVisibleRows) return true;
    return data.trips.some(
      (trip) =>
        trip.dayType === selectedDayType &&
        trip.stopTimes.some((stopTime) => stopTime.time == null),
    );
  }, [applicableRoutes, data.trips, selectedDayType]);

  const savePreference = useCallback(
    (
      nextStartCampusId: number | null,
      nextEndCampusId: number | null,
      nextShowDepartedTrips: boolean,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const saveGeneration = saveGenerationRef.current;
      setSaveState("saving");
      setSaveError(null);

      startTransition(async () => {
        try {
          const response = await fetch("/api/bus/preferences", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              preferredOriginCampusId: nextStartCampusId,
              preferredDestinationCampusId: nextEndCampusId,
              showDepartedTrips: nextShowDepartedTrips,
            }),
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          let body: unknown = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }

          if (saveGeneration !== saveGenerationRef.current) return;

          if (!response.ok) {
            dirtyRef.current = true;
            setSaveState("error");
            setSaveError(
              extractApiErrorMessage(body) ?? t("preferences.saveFailed"),
            );
            return;
          }

          dirtyRef.current = false;
          setSaveState("saved");
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
          if (saveGeneration !== saveGenerationRef.current) return;
          dirtyRef.current = true;
          setSaveState("error");
          setSaveError(t("preferences.saveFailed"));
        }
      });
    },
    [t],
  );

  useEffect(() => {
    if (!signedIn || !showPreferences || !dirtyRef.current) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      savePreference(startCampusId, endCampusId, showDepartedTrips);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    endCampusId,
    savePreference,
    showDepartedTrips,
    showPreferences,
    signedIn,
    startCampusId,
  ]);

  const markDirty = useCallback(() => {
    if (!signedIn || !showPreferences) return;
    dirtyRef.current = true;
    saveGenerationRef.current += 1;
    setSaveState("idle");
    setSaveError(null);
  }, [showPreferences, signedIn]);

  const handleSwap = useCallback(() => {
    markDirty();
    setStartCampusId(endCampusId);
    setEndCampusId(startCampusId);
  }, [endCampusId, markDirty, startCampusId]);

  const plannerMeta =
    saveState === "saving"
      ? t("preferences.saving")
      : saveState === "saved"
        ? t("preferences.saved")
        : saveState === "error"
          ? (saveError ?? t("preferences.saveFailed"))
          : t("preferences.autosaveHint");

  return (
    <div className={cn("relative min-w-0", className)}>
      <BusPlannerSettings
        markDirty={markDirty}
        selectedDayType={selectedDayType}
        setSelectedDayType={setSelectedDayType}
        setShowDepartedTrips={setShowDepartedTrips}
        showDepartedTrips={showDepartedTrips}
        t={t}
      />

      {signedIn && showPreferences ? (
        <p
          aria-live="polite"
          className={cn(
            "mb-3 text-xs leading-5",
            saveState === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {plannerMeta}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[22rem_minmax(0,1fr)]">
        <BusPlannerControls
          data={data}
          endCampusId={endCampusId}
          handleSwap={handleSwap}
          markDirty={markDirty}
          setEndCampusId={setEndCampusId}
          setStartCampusId={setStartCampusId}
          startCampusId={startCampusId}
          t={t}
        />

        <BusRouteTable
          dayType={selectedDayType}
          endCampusName={endCampus?.namePrimary ?? null}
          hideHeader={true}
          onReverse={handleSwap}
          routes={applicableRoutes}
          startCampusName={startCampus?.namePrimary ?? null}
          t={t}
          footer={
            data.notice?.message || showPlannerEstimatedHint ? (
              <>
                {data.notice?.message ? (
                  <p className="text-muted-foreground text-xs">
                    {data.notice.url ? (
                      <a
                        href={data.notice.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {data.notice.message}
                      </a>
                    ) : (
                      data.notice.message
                    )}
                  </p>
                ) : null}
                {showPlannerEstimatedHint ? (
                  <p className="text-muted-foreground text-xs">
                    {t("planner.estimatedHint")}
                  </p>
                ) : null}
              </>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
