import type { SubmitFunction } from "@sveltejs/kit";
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "./dashboard-controller-helpers";
import {
  actionResultError,
  validateCreateHomeworkForm as validateCreateHomeworkFormData,
} from "./forms";

type Setter<T> = (value: T) => void;
type HomeworksCopy = Parameters<typeof validateCreateHomeworkFormData>[1];

export function validateDashboardCreateHomeworkForm(
  formData: FormData,
  homeworksCopy: HomeworksCopy,
) {
  return validateCreateHomeworkFormData(formData, homeworksCopy, {
    titleMaxLength: HOMEWORK_TITLE_MAX_LENGTH,
    descriptionMaxLength: HOMEWORK_DESCRIPTION_MAX_LENGTH,
  });
}

export function createDashboardHomeworkAction({
  getHomeworksCopy,
  setCreating,
  setError,
}: {
  getHomeworksCopy: () => HomeworksCopy;
  setCreating: Setter<boolean>;
  setError: Setter<string>;
}): SubmitFunction {
  return ({ cancel, formData }) => {
    const homeworksCopy = getHomeworksCopy();
    const validationError = validateDashboardCreateHomeworkForm(
      formData,
      homeworksCopy,
    );
    setError(validationError);
    if (validationError) {
      cancel();
      return;
    }

    setCreating(true);
    return async ({ result, update }) => {
      try {
        if (result.type === "failure") {
          setError(actionResultError(result, homeworksCopy.createFailed));
          return;
        }
        await update();
      } finally {
        setCreating(false);
      }
    };
  };
}
