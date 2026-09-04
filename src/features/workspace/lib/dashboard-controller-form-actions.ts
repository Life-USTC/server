import {
  createDashboardHomeworkAction,
  validateDashboardCreateHomeworkForm,
} from "./dashboard-controller-homework-form-actions";
import {
  createDashboardTodoAction,
  updateDashboardTodoAction,
  validateDashboardTodoForm,
} from "./dashboard-controller-todo-form-actions";

type Setter<T> = (value: T) => void;
type TodoCopy = Parameters<typeof validateDashboardTodoForm>[1];
type HomeworksCopy = Parameters<typeof validateDashboardCreateHomeworkForm>[1];

export {
  createDashboardHomeworkAction,
  createDashboardTodoAction,
  updateDashboardTodoAction,
  validateDashboardCreateHomeworkForm,
  validateDashboardTodoForm,
};

export function createDashboardFormSubmitActions({
  getHomeworksCopy,
  getTodosCopy,
  onSuccess,
  setCreateHomeworkError,
  setCreateTodoError,
  setCreatingHomework,
  setCreatingTodo,
  setEditTodoError,
  setEditingTodo,
  setShowCreateTodo,
  setUpdatingTodo,
}: {
  getHomeworksCopy: () => HomeworksCopy;
  getTodosCopy: () => TodoCopy;
  onSuccess?: (action: "createHomework" | "createTodo" | "updateTodo") => void;
  setCreateHomeworkError: Setter<string>;
  setCreateTodoError: Setter<string>;
  setCreatingHomework: Setter<boolean>;
  setCreatingTodo: Setter<boolean>;
  setEditTodoError: Setter<string>;
  setEditingTodo: Setter<null>;
  setShowCreateTodo: Setter<boolean>;
  setUpdatingTodo: Setter<boolean>;
}) {
  return {
    createHomeworkAction: createDashboardHomeworkAction({
      getHomeworksCopy,
      onSuccess: () => onSuccess?.("createHomework"),
      setCreating: setCreatingHomework,
      setError: setCreateHomeworkError,
    }),
    createTodoAction: createDashboardTodoAction({
      getTodosCopy,
      onClose: () => {
        setShowCreateTodo(false);
      },
      onSuccess: () => onSuccess?.("createTodo"),
      setCreating: setCreatingTodo,
      setError: setCreateTodoError,
    }),
    updateTodoAction: updateDashboardTodoAction({
      getTodosCopy,
      onClose: () => {
        setEditingTodo(null);
      },
      onSuccess: () => onSuccess?.("updateTodo"),
      setError: setEditTodoError,
      setUpdating: setUpdatingTodo,
    }),
  };
}
