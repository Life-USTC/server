import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";
import * as fixtures from "./utils/mcp-tool-test-utils";

describe("dashboard link 工具 — 列表/搜索与置顶状态", () => {
  let dashboardLinkMcp: McpHarness | undefined;
  let dashboardLinkUserId: string | undefined;

  beforeAll(async () => {
    const marker = `mcp-dashboard-links-${Date.now()}`;
    const user = await fixtures.prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        name: "[integration-test] MCP Dashboard Links",
      },
      select: { id: true },
    });
    dashboardLinkUserId = user.id;
    dashboardLinkMcp = await createMcpHarness(user.id);
  });

  afterAll(async () => {
    await dashboardLinkMcp?.close();
    if (dashboardLinkUserId) {
      await fixtures.prisma.dashboardLinkPin.deleteMany({
        where: { userId: dashboardLinkUserId },
      });
      await fixtures.prisma.dashboardLinkClick.deleteMany({
        where: { userId: dashboardLinkUserId },
      });
      await fixtures.prisma.user.deleteMany({
        where: { id: dashboardLinkUserId },
      });
    }
    await fixtures.prisma.$disconnect();
  });

  it("catalog_link_list 搜索拼音且不包含个人状态", async () => {
    const result = await dashboardLinkMcp?.call<{
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
    if (!dashboardLinkUserId)
      throw new Error("Dashboard link test user missing");
    await fixtures.prisma.dashboardLinkPin.deleteMany({
      where: { userId: dashboardLinkUserId },
    });

    const pinned = await dashboardLinkMcp?.call<{
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

    const listed = await dashboardLinkMcp?.call<{
      pinnedSlugs?: string[];
    }>("workspace_link_pin_list");
    expect(listed?.pinnedSlugs).toContain("mail");

    const unpinned = await dashboardLinkMcp?.call<{
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
    if (!dashboardLinkUserId)
      throw new Error("Dashboard link test user missing");
    await fixtures.prisma.dashboardLinkPin.deleteMany({
      where: { userId: dashboardLinkUserId },
    });

    const result = await dashboardLinkMcp?.call<{
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
    expect(result?.message).toContain("missing-dashboard-link");
  });
});

// ---------------------------------------------------------------------------
// Bus tools — departure omits repeated campus objects
// ---------------------------------------------------------------------------
