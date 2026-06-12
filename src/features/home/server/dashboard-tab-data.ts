import { getBusTimetableData } from "@/features/bus/lib/bus-service";
import type { BusLocale, BusTimetableData } from "@/features/bus/lib/bus-types";
import type { TodoPriority } from "@/generated/prisma/client";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { prisma as basePrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type {
  HomeworkSummaryItem,
  SectionOption,
  SubscriptionsTabData,
} from "./subscription-read-model";
export {
  getCalendarSubscriptionUrl,
  getHomeworksTabData,
  getSubscriptionsTabData,
} from "./subscription-read-model";

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
  const todos = await basePrisma.todo.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      content: true,
      completed: true,
      priority: true,
      dueAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ completed: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });

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
