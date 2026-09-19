import { describe, expect, it } from "vitest";
import {
  GRADUATE_ACADEMIC_PORTAL_URL,
  UNDERGRADUATE_ACADEMIC_PORTAL_URL,
} from "@/features/welcome/lib/welcome-academic-portals";

describe("欢迎流程教务入口", () => {
  it("指向本科和研究生教务系统", () => {
    expect(UNDERGRADUATE_ACADEMIC_PORTAL_URL).toBe("https://jw.ustc.edu.cn/");
    expect(GRADUATE_ACADEMIC_PORTAL_URL).toBe("https://yjs1.ustc.edu.cn/");
  });
});
