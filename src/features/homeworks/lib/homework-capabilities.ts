/** Personal progress and shared content have independent authorization rules.
 * A suspension prevents shared writes but does not revoke the owner's progress.
 */
export function canCompletePersonalHomework(viewer: {
  isAuthenticated: boolean;
  loading?: boolean;
  failed?: boolean;
}) {
  return viewer.isAuthenticated && !viewer.loading && !viewer.failed;
}

export function homeworkCapabilities(viewer: {
  isAuthenticated: boolean;
  isSuspended: boolean;
  loading?: boolean;
  failed?: boolean;
}) {
  const canComplete = canCompletePersonalHomework(viewer);
  return {
    canComplete,
    canWriteShared: canComplete && !viewer.isSuspended,
  };
}

export type HomeworkCapabilities = ReturnType<typeof homeworkCapabilities>;
