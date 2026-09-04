import { describe, expect, it } from "vitest";
import * as fixtures from "../_harness";

describe("dashboard link 工具 — 列表/搜索与置顶状态", () => {
  const isolated = fixtures.createIsolatedMcpToolTestContext({
    emailPrefix: "mcp-dashboard-links",
    name: "[integration-test] MCP Dashboard Links",
    cleanup: async (isolatedUserId) => {
      await fixtures.prisma.workspaceLinkPin.deleteMany({
        where: { userId: isolatedUserId },
      });
      await fixtures.prisma.catalogLinkClick.deleteMany({
        where: { userId: isolatedUserId },
      });
    },
  });

  it("catalog_link_list 搜索拼音且不包含个人状态", async () => {
    const result = await isolated.client.call<{
      success?: boolean;
      query?: string | null;
      total?: number;
      returned?: number;
      links?: Array<{
        clickCount?: number;
        descriptionPinyin?: string;
        icon?: string;
        slug?: string;
        title?: string;
        titlePinyin?: string;
        url?: string;
        group?: string;
      }>;
    }>("catalog_link_list", {
      query: "youxiang",
    });

    expect(result?.success).toBe(true);
    expect(result?.query).toBe("youxiang");
    expect(result?.total).toBeGreaterThan(0);
    expect(result?.returned).toBeGreaterThan(0);
    const mail = result?.links?.find((link) => link.slug === "mail");
    expect(mail).toMatchObject({
      title: "邮箱",
      url: "https://mail.ustc.edu.cn/",
      group: "mostClicked",
    });
    expect(mail).not.toHaveProperty("isPinned");
    expect(mail).not.toHaveProperty("clickCount");
    expect(mail).not.toHaveProperty("titlePinyin");
    expect(mail).not.toHaveProperty("descriptionPinyin");
  });

  it("workspace_link_pin_set 为 MCP 用户置顶与取消置顶", async () => {
    await fixtures.prisma.workspaceLinkPin.deleteMany({
      where: { userId: isolated.userId },
    });

    const pinned = await isolated.client.call<{
      success?: boolean;
      action?: string;
      slug?: string;
      pinnedSlugs?: string[];
      maxPinnedLinks?: number;
    }>("workspace_link_pin_set", {
      slug: "mail",
      action: "pin",
    });

    expect(pinned).toMatchObject({
      success: true,
      action: "pin",
      slug: "mail",
      maxPinnedLinks: 4,
    });
    expect(pinned?.pinnedSlugs).toContain("mail");

    const listed = await isolated.client.call<{
      pinnedSlugs?: string[];
    }>("workspace_link_pin_list");
    expect(listed?.pinnedSlugs).toContain("mail");

    const unpinned = await isolated.client.call<{
      success?: boolean;
      action?: string;
      slug?: string;
      pinnedSlugs?: string[];
      maxPinnedLinks?: number;
    }>("workspace_link_pin_set", {
      slug: "mail",
      action: "unpin",
    });

    expect(unpinned).toMatchObject({
      success: true,
      action: "unpin",
      slug: "mail",
      maxPinnedLinks: 4,
    });
    expect(unpinned?.pinnedSlugs ?? []).not.toContain("mail");
  });

  it("workspace_link_pin_set 对无效 slug 返回校验载荷", async () => {
    await fixtures.prisma.workspaceLinkPin.deleteMany({
      where: { userId: isolated.userId },
    });

    const result = await isolated.client.call<{
      success?: boolean;
      error?: string;
      message?: string;
      slug?: string;
      pinnedSlugs?: string[];
      maxPinnedLinks?: number;
    }>("workspace_link_pin_set", {
      slug: "missing-dashboard-link",
      action: "pin",
    });

    expect(result).toMatchObject({
      success: false,
      error: "invalid_slug",
      slug: "missing-dashboard-link",
      pinnedSlugs: [],
      maxPinnedLinks: 4,
    });
    expect(result.message).toContain("missing-dashboard-link");
  });
});
