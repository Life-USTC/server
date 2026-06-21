import type { Prisma, TodoPriority } from "@/generated/prisma/client";

export type CalendarSection = Prisma.SectionGetPayload<{
  include: {
    course: true;
    schedules: {
      include: {
        room: { include: { building: { include: { campus: true } } } };
        teachers: true;
      };
    };
    exams: { include: { examRooms: true } };
  };
}>;

export type CalendarHomework = Prisma.HomeworkGetPayload<{
  include: {
    description: { select: { content: true } };
    section: { include: { course: true } };
  };
}>;

export type CalendarTodo = {
  id: string;
  title: string;
  content: string | null;
  dueAt: Date;
  priority: TodoPriority;
};
