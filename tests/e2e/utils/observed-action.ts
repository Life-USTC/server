/** Register the observation before acting, and retain both original outcomes. */
export async function observeAction<T>(
  observe: () => Promise<T>,
  action: () => Promise<unknown>,
): Promise<T> {
  const [observed, acted] = await Promise.allSettled([
    observe(),
    Promise.resolve().then(action),
  ]);
  if (observed.status === "rejected" || acted.status === "rejected")
    throw new AggregateError(
      [observed, acted].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      ),
      "Observation and action failed",
    );
  return observed.value;
}
