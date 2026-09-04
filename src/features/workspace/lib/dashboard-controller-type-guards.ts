import type {
  DashboardPageData,
  SignedDashboardData,
} from "./dashboard-controller-types";

export function isSignedDashboardData(
  data: DashboardPageData,
): data is SignedDashboardData {
  return Boolean(data.signedIn && !data.userMissing);
}
