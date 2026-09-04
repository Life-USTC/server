import {
  createWorkspaceHomeworkAction,
  validateWorkspaceCreateHomeworkForm,
} from "./workspace-controller-homework-form-actions";
import {
  createWorkspaceTodoAction,
  updateWorkspaceTodoAction,
  validateWorkspaceTodoForm,
} from "./workspace-controller-todo-form-actions";

type Setter<T> = (value: T) => void;
type TodoCopy = Parameters<typeof validateWorkspaceTodoForm>[1];
type HomeworksCopy = Parameters<typeof validateWorkspaceCreateHomeworkForm>[1];

export {
  createWorkspaceHomeworkAction,
  createWorkspaceTodoAction,
  updateWorkspaceTodoAction,
  validateWorkspaceCreateHomeworkForm,
  validateWorkspaceTodoForm,
};

export function createWorkspaceFormSubmitActions({
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
    createHomeworkAction: createWorkspaceHomeworkAction({
      getHomeworksCopy,
      onSuccess: () => onSuccess?.("createHomework"),
      setCreating: setCreatingHomework,
      setError: setCreateHomeworkError,
    }),
    createTodoAction: createWorkspaceTodoAction({
      getTodosCopy,
      onClose: () => {
        setShowCreateTodo(false);
      },
      onSuccess: () => onSuccess?.("createTodo"),
      setCreating: setCreatingTodo,
      setError: setCreateTodoError,
    }),
    updateTodoAction: updateWorkspaceTodoAction({
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
