import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import type {
  DashboardSectionCopy,
  SignedDashboardData,
} from "./dashboard-controller-types";

export function createExamTabDisplayActions({
  sectionCopy,
}: {
  locale: string;
  referenceNow: SignedDashboardData["referenceNow"];
  sectionCopy: DashboardSectionCopy;
}) {
  return {
    fmtExamDate: (value: Date | string | null | undefined) => {
      if (!value) return sectionCopy.examDateTBD;
      return formatShanghaiDate(value);
    },
  };
}
