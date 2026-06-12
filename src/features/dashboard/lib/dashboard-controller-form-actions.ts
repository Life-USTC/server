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
  setCreateHomeworkError,
  setCreateTodoError,
  setCreatingHomework,
  setCreatingTodo,
  setEditTodoError,
  setShowCreateTodo,
  setUpdatingTodo,
}: {
  getHomeworksCopy: () => HomeworksCopy;
  getTodosCopy: () => TodoCopy;
  setCreateHomeworkError: Setter<string>;
  setCreateTodoError: Setter<string>;
  setCreatingHomework: Setter<boolean>;
  setCreatingTodo: Setter<boolean>;
  setEditTodoError: Setter<string>;
  setShowCreateTodo: Setter<boolean>;
  setUpdatingTodo: Setter<boolean>;
}) {
  return {
    createHomeworkAction: createDashboardHomeworkAction({
      getHomeworksCopy,
      setCreating: setCreatingHomework,
      setError: setCreateHomeworkError,
    }),
    createTodoAction: createDashboardTodoAction({
      getTodosCopy,
      onClose: () => {
        setShowCreateTodo(false);
      },
      setCreating: setCreatingTodo,
      setError: setCreateTodoError,
    }),
    updateTodoAction: updateDashboardTodoAction({
      getTodosCopy,
      setError: setEditTodoError,
      setUpdating: setUpdatingTodo,
    }),
  };
}
