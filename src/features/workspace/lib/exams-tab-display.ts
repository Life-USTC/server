import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import type {
  SignedWorkspaceData,
  WorkspaceSectionCopy,
} from "./workspace-controller-types";

export function createExamTabDisplayActions({
  sectionCopy,
}: {
  locale: string;
  referenceNow: SignedWorkspaceData["referenceNow"];
  sectionCopy: WorkspaceSectionCopy;
}) {
  return {
    fmtExamDate: (value: Date | string | null | undefined) => {
      if (!value) return sectionCopy.examDateTBD;
      return formatShanghaiDate(value);
    },
  };
}
