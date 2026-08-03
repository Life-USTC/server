import type {
  DashboardSectionCopy,
  SignedDashboardData,
} from "./dashboard-controller-types";
import { formatDashboardDateTime } from "./date-formatters";
import { referenceDate } from "./overview";

export function createExamTabDisplayActions({
  locale,
  referenceNow,
  sectionCopy,
}: {
  locale: string;
  referenceNow: SignedDashboardData["referenceNow"];
  sectionCopy: DashboardSectionCopy;
}) {
  return {
    fmtExamDate: (value: Date | string | null | undefined) =>
      formatDashboardDateTime(
        value,
        sectionCopy.examDateTBD,
        referenceDate(referenceNow),
        locale,
      ),
  };
}
