import type { AppLocale } from "@/i18n/config";

export type ICalLabels = {
  courseCategory: string;
  examCategory: string;
  homeworkCategory: string;
  todoCategory: string;
  majorHomework: string;
  requiresTeam: string;
  teacherPrefix: string;
  experimentPrefix: string;
  examTypePrefix: string;
  examModePrefix: string;
  examTakeCountPrefix: string;
  examRoomPrefix: string;
  homeworkDuePrefix: string;
  todoDuePrefix: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
  examTypeLabels: Record<number, string>;
  examTypeFallback: string;
  locationTbd: string;
  examLocationTbd: string;
};

const LABELS: Record<AppLocale, ICalLabels> = {
  "zh-cn": {
    courseCategory: "课程",
    examCategory: "考试",
    homeworkCategory: "作业",
    todoCategory: "待办",
    majorHomework: "重要作业",
    requiresTeam: "需要组队",
    teacherPrefix: "教师：",
    experimentPrefix: "实验：",
    examTypePrefix: "类型：",
    examModePrefix: "考试方式：",
    examTakeCountPrefix: "考试人数：",
    examRoomPrefix: "考场：",
    homeworkDuePrefix: "作业截止：",
    todoDuePrefix: "待办截止：",
    priorityHigh: "高优先级",
    priorityMedium: "中优先级",
    priorityLow: "低优先级",
    examTypeLabels: { 1: "期中考试", 2: "期末考试" },
    examTypeFallback: "考试",
    locationTbd: "地点待定",
    examLocationTbd: "考场待定",
  },
  "en-us": {
    courseCategory: "Course",
    examCategory: "Exam",
    homeworkCategory: "Homework",
    todoCategory: "Todo",
    majorHomework: "Major Homework",
    requiresTeam: "Requires Team",
    teacherPrefix: "Teacher: ",
    experimentPrefix: "Experiment: ",
    examTypePrefix: "Type: ",
    examModePrefix: "Mode: ",
    examTakeCountPrefix: "Take Count: ",
    examRoomPrefix: "Room: ",
    homeworkDuePrefix: "HW Due: ",
    todoDuePrefix: "Todo Due: ",
    priorityHigh: "High Priority",
    priorityMedium: "Medium Priority",
    priorityLow: "Low Priority",
    examTypeLabels: { 1: "Midterm", 2: "Final" },
    examTypeFallback: "Exam",
    locationTbd: "Location TBD",
    examLocationTbd: "Exam Location TBD",
  },
};

export function getIcalLabels(locale: AppLocale) {
  return LABELS[locale] ?? LABELS["zh-cn"];
}

export function examTypeLabel(examType: number | null, locale: AppLocale) {
  const labels = getIcalLabels(locale);
  return labels.examTypeLabels[examType ?? -1] ?? labels.examTypeFallback;
}

export function priorityLabel(priority: string, locale: AppLocale) {
  const labels = getIcalLabels(locale);
  const map: Record<string, string> = {
    high: labels.priorityHigh,
    medium: labels.priorityMedium,
    low: labels.priorityLow,
  };
  return map[priority] ?? labels.priorityLow;
}
