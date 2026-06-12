import type {
  AnonymousDashboardData,
  DashboardPageData,
  SignedDashboardData,
} from "./dashboard-controller-types";

export function isSignedDashboardData(
  data: DashboardPageData,
): data is SignedDashboardData {
  return Boolean(data.signedIn && !data.userMissing);
}

export function isAnonymousDashboardData(
  data: DashboardPageData,
): data is AnonymousDashboardData {
  return !data.signedIn;
}
