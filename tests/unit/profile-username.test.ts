import { describe, expect, it } from "vitest";
import {
  isValidProfileUsername,
  PROFILE_USERNAME_MAX_LENGTH,
  PROFILE_USERNAME_PATTERN,
} from "@/features/profile/lib/profile-username";

describe("个人资料用户名规则", () => {
  it("暴露与表单输入相同的正则模式和长度限制", () => {
    expect(PROFILE_USERNAME_PATTERN).toBe("[a-z0-9-]+");
    expect(PROFILE_USERNAME_MAX_LENGTH).toBe(20);
  });

  it("允许小写字母、数字和连字符", () => {
    expect(isValidProfileUsername("student-2026")).toBe(true);
  });

  it("拒绝空、过长、大写和保留名称", () => {
    expect(isValidProfileUsername("")).toBe(false);
    expect(isValidProfileUsername("a".repeat(21))).toBe(false);
    expect(isValidProfileUsername("Student")).toBe(false);
    expect(isValidProfileUsername("id")).toBe(false);
  });
});
