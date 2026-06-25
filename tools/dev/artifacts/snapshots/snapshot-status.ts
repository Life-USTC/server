export function httpSnapshotError({
  expectedStatus,
  ok,
  status,
}: {
  expectedStatus: number | undefined;
  ok: boolean | null;
  status: number | null;
}) {
  if (status === null) {
    return expectedStatus === undefined
      ? undefined
      : `Expected HTTP ${expectedStatus}, received no response`;
  }
  if (expectedStatus !== undefined && status !== expectedStatus) {
    return `Expected HTTP ${expectedStatus}, received ${status}`;
  }
  if (expectedStatus === undefined && ok === false) {
    return `Unexpected HTTP ${status}`;
  }
  return undefined;
}
