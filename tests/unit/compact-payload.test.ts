import { describe, expect, it } from "vitest";
import { compactMcpPayload } from "@/lib/mcp/compact-dispatch";

describe("compactMcpPayload MCP 载荷压缩", () => {
  it("隐藏社区日历订阅路径中的访问令牌", () => {
    expect(
      compactMcpPayload({
        calendarPath: "/api/calendar-feeds/user-1:private-token.ics",
      }),
    ).toEqual({
      calendarPath: "/api/calendar-feeds/user-1:[redacted].ics",
    });
  });

  describe("原始类型和数组", () => {
    it("原样透传 null", () => {
      expect(compactMcpPayload(null)).toBeNull();
    });

    it("原样透传 undefined", () => {
      expect(compactMcpPayload(undefined)).toBeUndefined();
    });

    it("原样透传字符串", () => {
      expect(compactMcpPayload("hello")).toBe("hello");
    });

    it("原样透传数字", () => {
      expect(compactMcpPayload(42)).toBe(42);
    });

    it("原样透传布尔值", () => {
      expect(compactMcpPayload(true)).toBe(true);
    });

    it("空数组返回空数组", () => {
      expect(compactMcpPayload([])).toEqual([]);
    });

    it("原始类型数组保持不变", () => {
      expect(compactMcpPayload([1, "a", null])).toEqual([1, "a", null]);
    });

    it("递归压缩对象数组", () => {
      const input = [{ todos: [{ id: "1", title: "T", extra: "x" }] }];
      const result = compactMcpPayload(input) as Record<string, unknown>[];
      expect(result).toHaveLength(1);
      expect(
        (result[0].todos as Record<string, unknown>[])[0],
      ).not.toHaveProperty("extra");
    });

    it("递归省略 Markdown 派生 HTML 字段", () => {
      const input = {
        description: {
          content: "Source Markdown",
          renderedHtml: "<p>Source Markdown</p>",
        },
        comments: [
          {
            body: "Comment Markdown",
            renderedBody: "<p>Comment Markdown</p>",
            replies: [
              {
                body: "Reply Markdown",
                renderedBody: "<p>Reply Markdown</p>",
              },
            ],
          },
        ],
      };

      expect(compactMcpPayload(input)).toEqual({
        description: { content: "Source Markdown" },
        comments: [
          {
            body: "Comment Markdown",
            replies: [{ body: "Reply Markdown" }],
          },
        ],
      });
    });

    it("压缩顶层已知记录数组", () => {
      const input = [
        {
          id: "c1",
          jwId: "J1",
          code: "CS101",
          namePrimary: "Intro CS",
          credit: 3,
          hours: 48,
          description: "removed",
        },
      ];

      const result = compactMcpPayload(input) as Record<string, unknown>[];

      expect(result[0]).toEqual({
        id: "c1",
        jwId: "J1",
        code: "CS101",
        namePrimary: "Intro CS",
        credit: 3,
        hours: 48,
      });
    });
  });

  describe("待办事项", () => {
    it("压缩待办项，仅保留预期字段", () => {
      const input = {
        todos: [
          {
            id: "t1",
            title: "Buy groceries",
            content: "Milk, eggs",
            priority: 1,
            dueAt: "2024-01-01",
            completed: false,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
            userId: "u1",
            extraField: "should be removed",
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const todos = result.todos as Record<string, unknown>[];
      expect(todos[0]).toEqual({
        id: "t1",
        title: "Buy groceries",
        content: "Milk, eggs",
        priority: 1,
        dueAt: "2024-01-01",
        completed: false,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      });
    });

    it("保留包装对象的同级字段", () => {
      const input = { todos: [], totalCount: 5 };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      expect(result.totalCount).toBe(5);
    });
  });

  describe("课程", () => {
    it("压缩课程项", () => {
      const input = {
        courses: [
          {
            id: "c1",
            jwId: "J1",
            code: "CS101",
            namePrimary: "Intro CS",
            nameSecondary: "计算机导论",
            credit: 3,
            hours: 48,
            description: "removed",
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const courses = result.courses as Record<string, unknown>[];
      expect(courses[0]).toEqual({
        id: "c1",
        jwId: "J1",
        code: "CS101",
        namePrimary: "Intro CS",
        nameSecondary: "计算机导论",
        credit: 3,
        hours: 48,
      });
    });
  });

  describe("课段", () => {
    it("压缩嵌套课程和学期的课段", () => {
      const input = {
        sections: [
          {
            id: "s1",
            jwId: "J1",
            code: "S101",
            namePrimary: "Section A",
            nameSecondary: "A组",
            campusId: "campus1",
            openDepartmentId: "dept1",
            extraField: "removed",
            course: {
              id: "c1",
              jwId: "J1",
              code: "CS101",
              namePrimary: "Intro CS",
              nameSecondary: "计算机导论",
              credit: 3,
              hours: 48,
              description: "removed",
            },
            semester: {
              id: "sem1",
              jwId: "SJ1",
              code: "2024S",
              nameCn: "2024春",
              namePrimary: "Spring 2024",
              extra: "removed",
            },
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const sections = result.sections as Record<string, unknown>[];
      expect(sections[0]).toHaveProperty("course");
      expect(sections[0]).toHaveProperty("semester");
      expect(sections[0].course as Record<string, unknown>).not.toHaveProperty(
        "description",
      );
      expect(
        sections[0].semester as Record<string, unknown>,
      ).not.toHaveProperty("extra");
    });
  });

  describe("作业", () => {
    it("压缩嵌套描述和用户信息的作业", () => {
      const input = {
        homeworks: [
          {
            id: "h1",
            sectionId: "s1",
            title: "HW1",
            isMajor: false,
            requiresTeam: false,
            publishedAt: "2024-01-01",
            submissionStartAt: "2024-01-01",
            submissionDueAt: "2024-01-15",
            deletedAt: null,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
            extraField: "removed",
            description: {
              id: "d1",
              content: "Do problems 1-5",
              lastEditedAt: "2024-01-01",
              lastEditedById: "u1",
              extraField: "removed",
            },
            createdBy: {
              id: "u1",
              name: "Teacher",
              username: "teacher",
              image: "img.png",
              email: "removed",
            },
            updatedBy: null,
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const homeworks = result.homeworks as Record<string, unknown>[];
      const hw = homeworks[0];
      expect(hw).not.toHaveProperty("extraField");
      expect(hw.description as Record<string, unknown>).not.toHaveProperty(
        "extraField",
      );
      expect(hw.createdBy as Record<string, unknown>).not.toHaveProperty(
        "email",
      );
      expect(hw.updatedBy).toBeNull();
    });

    it("不添加缺失的可选嵌套字段", () => {
      const input = {
        homeworks: [
          {
            id: "h1",
            sectionId: "s1",
            title: "HW2",
            isMajor: false,
            requiresTeam: false,
            publishedAt: null,
            submissionStartAt: null,
            submissionDueAt: null,
            deletedAt: null,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const hw = (result.homeworks as Record<string, unknown>[])[0];
      expect(hw).not.toHaveProperty("description");
      expect(hw).not.toHaveProperty("section");
      expect(hw).not.toHaveProperty("createdBy");
    });
  });

  describe("日程", () => {
    it("压缩嵌套课段、带楼宇的教室和教师的日程", () => {
      const input = {
        schedules: [
          {
            id: "sch1",
            jwId: "J1",
            date: "2024-03-01",
            weekday: 1,
            startTime: "08:00",
            endTime: "09:35",
            weekIndex: 3,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
            extraField: "removed",
            section: {
              id: "s1",
              jwId: "J1",
              code: "S101",
              namePrimary: "Section A",
              nameSecondary: "A组",
              campusId: "c1",
              openDepartmentId: "d1",
            },
            room: {
              id: "r1",
              jwId: "RJ1",
              namePrimary: "Room 101",
              nameSecondary: "101教室",
              extraField: "removed",
              building: {
                id: "b1",
                jwId: "BJ1",
                namePrimary: "Science Building",
                nameSecondary: "理科楼",
                address: "removed",
              },
            },
            teachers: [
              {
                id: "t1",
                jwId: "TJ1",
                namePrimary: "Dr. Smith",
                nameSecondary: "史密斯",
                email: "removed",
              },
            ],
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const sch = (result.schedules as Record<string, unknown>[])[0];
      expect(sch).not.toHaveProperty("extraField");
      const room = sch.room as Record<string, unknown>;
      expect(room).not.toHaveProperty("extraField");
      const building = room.building as Record<string, unknown>;
      expect(building).not.toHaveProperty("address");
      const teachers = sch.teachers as Record<string, unknown>[];
      expect(teachers[0]).not.toHaveProperty("email");
    });
  });

  describe("考试", () => {
    it("压缩嵌套 examBatch 和 examRooms 的考试", () => {
      const input = {
        exams: [
          {
            id: "e1",
            jwId: "EJ1",
            examDate: "2024-06-15",
            startTime: "14:00",
            endTime: "16:00",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
            extraField: "removed",
            examBatch: {
              id: "eb1",
              jwId: "EBJ1",
              namePrimary: "Final Exam Batch 1",
              nameSecondary: "期末考试第一批",
              extraField: "removed",
            },
            examRooms: [
              {
                id: "er1",
                jwId: "ERJ1",
                roomName: "Room 301",
                buildingName: "Exam Hall",
                capacity: 100,
              },
            ],
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const exam = (result.exams as Record<string, unknown>[])[0];
      expect(exam).not.toHaveProperty("extraField");
      expect(exam.examBatch as Record<string, unknown>).not.toHaveProperty(
        "extraField",
      );
      expect(
        (exam.examRooms as Record<string, unknown>[])[0],
      ).not.toHaveProperty("capacity");
    });
  });

  describe("事件", () => {
    it("通过 compactSchedule 路由日程事件", () => {
      const input = {
        events: [
          {
            type: "schedule",
            at: "2024-03-01T08:00:00Z",
            payload: {
              id: "sch1",
              jwId: "J1",
              date: "2024-03-01",
              weekday: 1,
              startTime: "08:00",
              endTime: "09:35",
              weekIndex: 3,
              createdAt: "2024-01-01",
              updatedAt: "2024-01-01",
              extra: "removed",
            },
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const events = result.events as Record<string, unknown>[];
      expect(events[0]).toHaveProperty("type", "schedule");
      expect(events[0]).toHaveProperty("at");
      expect(events[0].payload as Record<string, unknown>).not.toHaveProperty(
        "extra",
      );
    });

    it("通过 compactHomework 路由作业到期事件", () => {
      const input = {
        events: [
          {
            type: "homework_due",
            at: "2024-01-15T23:59:00Z",
            payload: {
              id: "h1",
              sectionId: "s1",
              title: "HW1",
              isMajor: false,
              requiresTeam: false,
              publishedAt: null,
              submissionStartAt: null,
              submissionDueAt: "2024-01-15",
              deletedAt: null,
              createdAt: "2024-01-01",
              updatedAt: "2024-01-01",
              extraField: "removed",
            },
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const events = result.events as Record<string, unknown>[];
      expect(events[0].payload as Record<string, unknown>).not.toHaveProperty(
        "extraField",
      );
    });

    it("通过 compactExam 路由考试事件", () => {
      const input = {
        events: [
          {
            type: "exam",
            at: "2024-06-15T14:00:00Z",
            payload: {
              id: "e1",
              jwId: "EJ1",
              examDate: "2024-06-15",
              startTime: "14:00",
              endTime: "16:00",
              createdAt: "2024-01-01",
              updatedAt: "2024-01-01",
              extra: "removed",
            },
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const events = result.events as Record<string, unknown>[];
      expect(events[0].payload as Record<string, unknown>).not.toHaveProperty(
        "extra",
      );
    });

    it("通过 compactTodo 路由待办到期事件", () => {
      const input = {
        events: [
          {
            type: "todo_due",
            at: "2024-01-01T00:00:00Z",
            payload: {
              id: "t1",
              title: "Buy groceries",
              content: "Milk",
              priority: 1,
              dueAt: "2024-01-01",
              completed: false,
              createdAt: "2024-01-01",
              updatedAt: "2024-01-01",
              userId: "removed",
            },
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const events = result.events as Record<string, unknown>[];
      expect(events[0].payload as Record<string, unknown>).not.toHaveProperty(
        "userId",
      );
    });

    it("处理无载荷事件", () => {
      const input = {
        events: [{ type: "schedule", at: "2024-01-01" }],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const events = result.events as Record<string, unknown>[];
      expect(events[0]).toEqual({ type: "schedule", at: "2024-01-01" });
    });

    it("不通过结构推断压缩通用载荷", () => {
      const input = {
        nextClass: {
          type: "schedule",
          at: "2024-03-01T08:00:00Z",
          payload: {
            id: "sch1",
            jwId: "J1",
            date: "2024-03-01",
            weekday: 1,
            startTime: "08:00",
            endTime: "09:35",
            weekIndex: 3,
            scheduleGroup: { id: "remove-me" },
            roomType: { id: "remove-me-too" },
            room: {
              id: "r1",
              jwId: "RJ1",
              namePrimary: "Room 101",
              nameSecondary: "101教室",
            },
          },
        },
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const nextClass = result.nextClass as Record<string, unknown>;
      const payload = nextClass.payload as Record<string, unknown>;
      expect(payload).toHaveProperty("scheduleGroup");
      expect(payload).toHaveProperty("roomType");
      expect(payload.room).toEqual({
        id: "r1",
        jwId: "RJ1",
        namePrimary: "Room 101",
        nameSecondary: "101教室",
      });
    });

    it("不会将考试对象误判为日程（考试有 startTime/endTime/sectionId 但没有 date+weekday）", () => {
      const input = {
        exams: [
          {
            id: "e1",
            jwId: "EJ1",
            sectionId: "s1",
            examDate: "2024-06-15",
            startTime: "14:00",
            endTime: "16:00",
            examType: 1,
            examMode: "offline",
            examTakeCount: 1,
            createdAt: "2024-01-01",
            updatedAt: "2024-01-01",
            extraField: "removed",
            examRooms: [
              {
                id: "er1",
                jwId: "ERJ1",
                roomName: "Room 301",
                buildingName: "Exam Hall",
                count: 50,
                capacity: 100,
              },
            ],
          },
        ],
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      const exam = (result.exams as Record<string, unknown>[])[0];
      // Should be processed as an exam, not a schedule
      expect(exam).toHaveProperty("examDate", "2024-06-15");
      expect(exam).toHaveProperty("startTime", "14:00");
      expect(exam).not.toHaveProperty("extraField");
      // examRooms should be preserved and compacted (capacity stripped)
      expect(
        (exam.examRooms as Record<string, unknown>[])[0],
      ).not.toHaveProperty("capacity");
      expect((exam.examRooms as Record<string, unknown>[])[0]).toHaveProperty(
        "roomName",
        "Room 301",
      );
    });
  });

  describe("回退单数键", () => {
    it("压缩单数 'course' 键", () => {
      const input = {
        course: { id: "c1", code: "CS101", namePrimary: "CS", extra: "x" },
        otherField: "preserved",
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      expect(result.course as Record<string, unknown>).not.toHaveProperty(
        "extra",
      );
      expect(result.otherField).toBe("preserved");
    });

    it("压缩单数 'todo' 键", () => {
      const input = {
        todo: { id: "t1", title: "T", userId: "removed" },
      };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      expect(result.todo as Record<string, unknown>).not.toHaveProperty(
        "userId",
      );
    });

    it("保留输出中的未知字段", () => {
      const input = { unknownField: "value", anotherField: 42 };
      const result = compactMcpPayload(input) as Record<string, unknown>;
      expect(result).toEqual({ unknownField: "value", anotherField: 42 });
    });
  });

  describe("班车时刻表", () => {
    it("为原始班次数组保留 stopTimes", () => {
      const input = {
        trips: [
          {
            id: 1,
            routeId: 10,
            dayType: "weekday",
            position: 2,
            departureTime: "07:30",
            arrivalTime: "08:10",
            stopTimes: [
              {
                stopOrder: 0,
                campusId: 1,
                campusName: "East Campus",
                time: "07:30",
                minutesSinceMidnight: 450,
                isPassThrough: false,
              },
              {
                stopOrder: 1,
                campusId: 4,
                campusName: "West Campus",
                time: "08:10",
                minutesSinceMidnight: 490,
                isPassThrough: false,
              },
            ],
          },
        ],
      };

      const result = compactMcpPayload(input) as Record<string, unknown>;
      expect((result.trips as Array<Record<string, unknown>>)[0]).toEqual(
        expect.objectContaining({
          routeId: 10,
          dayType: "weekday",
          stopTimes: [
            expect.objectContaining({
              stopOrder: 0,
              campusId: 1,
              time: "07:30",
            }),
            expect.objectContaining({
              stopOrder: 1,
              campusId: 4,
              time: "08:10",
            }),
          ],
        }),
      );
    });

    it("为单线路日程保留每站时刻槽", () => {
      const input = {
        weekday: [
          {
            position: 1,
            stopTimes: [
              { stopOrder: 0, time: "07:30" },
              { stopOrder: 1, time: "08:10" },
            ],
          },
        ],
        weekend: [
          {
            position: 1,
            stopTimes: [
              { stopOrder: 0, time: "09:00" },
              { stopOrder: 1, time: "09:40" },
            ],
          },
        ],
      };

      const result = compactMcpPayload(input) as Record<string, unknown>;
      expect(result.weekday).toEqual([
        {
          position: 1,
          stopTimes: [
            { stopOrder: 0, time: "07:30" },
            { stopOrder: 1, time: "08:10" },
          ],
        },
      ]);
      expect(result.weekend).toEqual([
        {
          position: 1,
          stopTimes: [
            { stopOrder: 0, time: "09:00" },
            { stopOrder: 1, time: "09:40" },
          ],
        },
      ]);
    });
  });

  describe("日历订阅", () => {
    it("保留订阅摘要字段而不是强制转换为原始形状", () => {
      const input = {
        success: true,
        subscription: {
          userId: "user-1",
          sectionCount: 2,
          currentSemesterSectionCount: 1,
          currentSemesterSections: [{ id: 1, code: "CS101.01" }],
          calendarPath: "/api/calendar-feeds/user-1.ics?token=secret",
          calendarUrl:
            "https://life.example/api/calendar-feeds/user-1.ics?token=secret",
          note: "summary",
        },
      };

      const result = compactMcpPayload(input) as Record<string, unknown>;
      expect(result.subscription).toEqual(
        expect.objectContaining({
          userId: "user-1",
          sectionCount: 2,
          currentSemesterSectionCount: 1,
          currentSemesterSections: [{ id: 1, code: "CS101.01" }],
          note: "summary",
        }),
      );
    });
  });
});
