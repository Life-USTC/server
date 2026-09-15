import { afterEach, describe, expect, it, vi } from "vitest";
import {
  examDateTime,
  examReferenceNow,
  formatDateOnly,
} from "@/features/workspace/lib/exam-date-display";
import { flattenExamRows } from "@/features/workspace/lib/exam-rows";
import type {
  WorkspaceExam,
  WorkspaceExamSection,
  WorkspaceExamSubscriptions,
} from "@/features/workspace/lib/exam-types";

const options = {
  dateFallback: "TBD",
  notAvailable: "N/A",
};

function exam(overrides: Partial<WorkspaceExam> = {}): WorkspaceExam {
  return {
    examBatch: null,
    examDate: "2026-05-22",
    examMode: null,
    examRooms: [],
    examTakeCount: null,
    examType: null,
    endTime: 900,
    id: 1,
    startTime: 800,
    ...overrides,
  };
}

function subscriptions(
  item: WorkspaceExam,
): WorkspaceExamSubscriptions<WorkspaceExamSection> {
  return {
    subscriptions: [
      {
        sections: [
          {
            course: { namePrimary: "Physics" },
            exams: [item],
          },
        ],
      },
    ],
  };
}

describe.each(["UTC", "Asia/Shanghai"])(
  "考试时刻在 %s 主机时区下保持上海时间",
  (timezone) => {
    afterEach(() => vi.unstubAllEnvs());

    it("从日期字符串和 Date 对象构造 HHMM 结束时刻", () => {
      vi.stubEnv("TZ", timezone);
      const dateObject = new Date("2026-05-21T16:00:00.000Z");

      expect(formatDateOnly("2026-05-22", "TBD")).toBe("2026-05-22");
      expect(formatDateOnly(dateObject, "TBD")).toBe("2026-05-22");
      expect(examDateTime("2026-05-22", 930)?.toISOString()).toBe(
        "2026-05-22T01:30:00.000Z",
      );
      expect(examDateTime(dateObject, 930)?.toISOString()).toBe(
        "2026-05-22T01:30:00.000Z",
      );
    });

    it("没有时间时使用上海当天的最后一毫秒", () => {
      vi.stubEnv("TZ", timezone);

      expect(examDateTime("2026-05-22", null)?.toISOString()).toBe(
        "2026-05-22T15:59:59.999Z",
      );
    });

    it("在结束瞬间将考试标为已完成", () => {
      vi.stubEnv("TZ", timezone);

      const atEnd = flattenExamRows(
        subscriptions(exam()),
        "2026-05-22T09:00:00+08:00",
        options,
      );
      const beforeEnd = flattenExamRows(
        subscriptions(exam()),
        "2026-05-22T08:59:59+08:00",
        options,
      );

      expect(atEnd[0]?.completed).toBe(true);
      expect(beforeEnd[0]?.completed).toBe(false);
    });
  },
);

describe("考试日期输入边界", () => {
  it("拒绝无效日期并保持参考时间的上海解析", () => {
    expect(examDateTime("not-a-date", 900)).toBeNull();
    expect(examDateTime(new Date("invalid"), 900)).toBeNull();
    expect(formatDateOnly("not-a-date", "TBD")).toBe("TBD");
    expect(examReferenceNow("2026-05-22T10:00").toISOString()).toBe(
      "2026-05-22T02:00:00.000Z",
    );
  });
});
