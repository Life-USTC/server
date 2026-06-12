import type { SubmitFunction } from "@sveltejs/kit";
import { displayWelcomeName } from "@/features/welcome/lib/welcome-display";

export function createCompleteProfileAction({
  setCompleting,
}: {
  setCompleting: (value: boolean) => void;
}): SubmitFunction {
  return () => {
    setCompleting(true);
    return async ({ update }) => {
      try {
        await update({ reset: false });
      } finally {
        setCompleting(false);
      }
    };
  };
}

export function buildWelcomeSemesterOptions(
  semesters: Array<{
    id: number | string;
    nameCn?: string | null;
    nameEn?: string | null;
  }>,
  locale: string,
) {
  return semesters.map((semester) => ({
    value: String(semester.id),
    label: displayWelcomeName(semester, locale),
  }));
}
