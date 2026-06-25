import type { BusLocale, BusTimetableData } from "@/features/bus/lib/bus-types";
import { getBusTimetableData } from "@/features/bus/server/bus-service";
import { listTodos } from "@/features/todos/server/todo-service";
import type { TodoPriority } from "@/generated/prisma/client";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type {
  HomeworkSummaryItem,
  SectionOption,
  SubscriptionsTabData,
} from "@/features/subscriptions/server/subscription-read-model";
export {
  getCalendarSubscriptionUrl,
  getHomeworksTabData,
  getSubscriptionsTabData,
} from "@/features/subscriptions/server/subscription-read-model";

export type BusDashboardData = {
  data: BusTimetableData | null;
};

export async function getBusTabData(
  userId: string,
  locale: AppLocale = DEFAULT_LOCALE,
): Promise<BusDashboardData> {
  const referenceNow = shanghaiDayjs();
  const busLocale: BusLocale = locale === "en-us" ? "en-us" : "zh-cn";

  return {
    data: await getBusTimetableData({
      locale: busLocale,
      userId,
      now: referenceNow.toISOString(),
    }),
  };
}

export type TodoItem = {
  id: string;
  title: string;
  content: string | null;
  completed: boolean;
  priority: TodoPriority;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getTodosTabData(userId: string): Promise<TodoItem[]> {
  const todos = await listTodos({ userId });

  return todos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    content: todo.content ?? null,
    completed: todo.completed,
    priority: todo.priority,
    dueAt: todo.dueAt ? toShanghaiIsoString(todo.dueAt) : null,
    createdAt: toShanghaiIsoString(todo.createdAt),
    updatedAt: toShanghaiIsoString(todo.updatedAt),
  }));
}
