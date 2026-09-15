import { describe, expect, it } from "vitest";
import { parseCreateHomeworkInput } from "@/lib/api/routes/homework-create-input";

describe("作业创建输入解析", () => {
  it("接受公开 section JW ID 作为替代 section 引用", () => {
    const result = parseCreateHomeworkInput({
      sectionJwId: 12345,
      title: "Homework 1",
    });

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      sectionId: null,
      sectionJwId: 12345,
      title: "Homework 1",
    });
  });

  it("为兼容性继续接受内部 section ID", () => {
    const result = parseCreateHomeworkInput({
      sectionId: "42",
      title: "Homework 1",
    });

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      sectionId: 42,
      sectionJwId: null,
    });
  });
});
