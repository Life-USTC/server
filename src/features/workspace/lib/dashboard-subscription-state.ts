type DashboardSubscriptionCountSource = {
  subscribedSectionCount?: number | null;
};

export function hasDashboardSubscriptions(
  source: DashboardSubscriptionCountSource,
) {
  return (source.subscribedSectionCount ?? 0) > 0;
}
