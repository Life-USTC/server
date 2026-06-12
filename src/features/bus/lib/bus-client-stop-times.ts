import type { BusComputedStopTime } from "./bus-client-types";
import type { BusTripStopTime } from "./bus-types";

function formatMinutesAsTime(minutes: number) {
  const hour = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (minutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function estimateStopMinutes(
  stopTimes: BusTripStopTime[],
  stopIndex: number,
): { minutes: number | null; isEstimated: boolean } {
  const exact = stopTimes[stopIndex]?.minutesSinceMidnight ?? null;
  if (exact != null) {
    return { minutes: exact, isEstimated: false };
  }

  let previous: number | null = null;
  for (let index = stopIndex - 1; index >= 0; index -= 1) {
    const minutes = stopTimes[index]?.minutesSinceMidnight ?? null;
    if (minutes != null) {
      previous = minutes;
      break;
    }
  }

  let next: number | null = null;
  for (let index = stopIndex + 1; index < stopTimes.length; index += 1) {
    const minutes = stopTimes[index]?.minutesSinceMidnight ?? null;
    if (minutes != null) {
      next = minutes;
      break;
    }
  }

  if (previous != null && next != null) {
    return {
      minutes: Math.round((previous + next) / 2),
      isEstimated: true,
    };
  }

  if (previous != null || next != null) {
    return {
      minutes: previous ?? next,
      isEstimated: true,
    };
  }

  return { minutes: null, isEstimated: false };
}

export function buildComputedStopTime(
  stopTimes: BusTripStopTime[],
  stopIndex: number,
): BusComputedStopTime {
  const stopTime = stopTimes[stopIndex];
  const estimated = estimateStopMinutes(stopTimes, stopIndex);
  const displayMinutes = estimated.minutes;
  const displayTime =
    stopTime?.time ??
    (displayMinutes != null ? formatMinutesAsTime(displayMinutes) : null);

  return {
    ...stopTime,
    displayTime,
    displayMinutes,
    isEstimated: estimated.isEstimated,
  };
}
