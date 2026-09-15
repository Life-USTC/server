type WorkspaceSubscriptionCountSource = {
  subscribedSectionCount?: number | null;
};

export function hasWorkspaceSubscriptions(
  source: WorkspaceSubscriptionCountSource,
) {
  return (source.subscribedSectionCount ?? 0) > 0;
}
