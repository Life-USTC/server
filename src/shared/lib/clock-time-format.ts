/**
 * Formats a time integer (hhmm or hmm) to hh:mm string format
 * @param time - Integer representing time (e.g., 800, 1030, 1400)
 * @returns Formatted time string (e.g., "08:00", "10:30", "14:00")
 */
export function formatTime(time: number | null | undefined): string {
  if (time === null || time === undefined) return "—";

  const timeStr = String(time).padStart(4, "0");
  const hours = timeStr.slice(0, 2);
  const minutes = timeStr.slice(2, 4);

  return `${hours}:${minutes}`;
}

// Converts hhmm integers to minutes for easier duration math.
export function toMinutes(time: number | null | undefined): number {
  if (time === null || time === undefined) return 0;
  return Math.floor(time / 100) * 60 + (time % 100);
}

// Formats a duration between two hhmm integers into a human-readable string.
export function formatDuration(startTime: number, endTime: number): string {
  const minutes = Math.max(toMinutes(endTime) - toMinutes(startTime), 0);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
