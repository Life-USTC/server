/**
 * A request-duration clock that is independent of wall-clock corrections.
 *
 * Date.now() remains appropriate for expiry/age calculations. It must not be
 * used to measure elapsed work because NTP or test clock adjustments can make
 * a duration negative or otherwise misleading.
 */
export function monotonicNowMs() {
  return performance.now();
}

export function elapsedMs(startAt: number) {
  const elapsed = monotonicNowMs() - startAt;
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
}
