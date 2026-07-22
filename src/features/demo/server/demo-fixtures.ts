import type { DemoPrincipal } from "./demo-auth";

const TODOS = [
  {
    id: "demo-todo-prepare",
    title: "准备下一节课",
    completed: false,
    priority: "high",
  },
  {
    id: "demo-todo-review",
    title: "复习课程笔记",
    completed: true,
    priority: "medium",
  },
] as const;

export function getDemoTodos(_principal: DemoPrincipal) {
  return TODOS;
}

export function simulateDemoTodoCreate(
  principal: DemoPrincipal,
  title: string,
) {
  return {
    simulated: true as const,
    todo: {
      id: `demo-simulated-${principal.sessionId.slice(0, 8)}`,
      title,
      completed: false,
      priority: "medium" as const,
    },
  };
}
