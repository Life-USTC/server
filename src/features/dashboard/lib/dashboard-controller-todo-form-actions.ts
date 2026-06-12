import type { SubmitFunction } from "@sveltejs/kit";
import {
  TODO_CONTENT_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from "./dashboard-controller-helpers";
import {
  actionResultError,
  validateTodoForm as validateTodoFormData,
} from "./forms";
import { createTodoSubmitAction, updateTodoSubmitAction } from "./todos";

type Setter<T> = (value: T) => void;
type TodoCopy = Parameters<typeof validateTodoFormData>[1];

export function validateDashboardTodoForm(
  formData: FormData,
  todosCopy: TodoCopy,
) {
  return validateTodoFormData(formData, todosCopy, {
    titleMaxLength: TODO_TITLE_MAX_LENGTH,
    contentMaxLength: TODO_CONTENT_MAX_LENGTH,
  });
}

export function createDashboardTodoAction({
  getTodosCopy,
  onClose,
  setCreating,
  setError,
}: {
  getTodosCopy: () => TodoCopy;
  onClose: () => void;
  setCreating: Setter<boolean>;
  setError: Setter<string>;
}): SubmitFunction {
  return ({ cancel, formData }) => {
    const todosCopy = getTodosCopy();
    return createTodoSubmitAction({
      actionResultError,
      fallbackMessage: todosCopy.saveFailed,
      onClose,
      setCreating,
      setError,
      validate: (data) => validateDashboardTodoForm(data, todosCopy),
    })({ cancel, formData });
  };
}

export function updateDashboardTodoAction({
  getTodosCopy,
  setError,
  setUpdating,
}: {
  getTodosCopy: () => TodoCopy;
  setError: Setter<string>;
  setUpdating: Setter<boolean>;
}): SubmitFunction {
  return ({ cancel, formData }) => {
    const todosCopy = getTodosCopy();
    return updateTodoSubmitAction({
      actionResultError,
      fallbackMessage: todosCopy.saveFailed,
      setError,
      setUpdating,
      validate: (data) => validateDashboardTodoForm(data, todosCopy),
    })({ cancel, formData });
  };
}
