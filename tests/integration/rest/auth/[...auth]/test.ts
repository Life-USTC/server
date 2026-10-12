import { expect } from "@playwright/test";
import { signIn, test } from "../../_harness/auth";
import { assertApiContract } from "../../_shared/api-contract";

test("/api/auth/[...auth] 契约检查", { tag: "@Account/REST" }, async ({
  run,
  request,
}) => {
  await run(async () => {
    await assertApiContract(request, { routePath: "/api/auth/[...auth]" });
  });
});

test("/api/auth/[...auth] 未登录 get-session 返回 null", {
  tag: "@Account/REST",
}, async ({ run, request }) => {
  await run(async () => {
    const response = await request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeNull();
  });
});

test("/api/auth/[...auth] 普通用户登录后 session 正确", {
  tag: "@Account/REST",
}, async ({ run, request, account }) => {
  await run(async () => {
    await signIn(request, account);

    const response = await request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      user?: { id?: string; username?: string | null; isAdmin?: boolean };
    };
    expect(typeof body.user?.id).toBe("string");
    expect(typeof body.user?.username).toBe("string");
    expect(body.user?.isAdmin).toBe(false);
  });
});

test("/api/auth/[...auth] 管理员登录后 session 标记 admin", {
  tag: "@Account/REST",
}, async ({ run, request, adminAccount }) => {
  await run(async () => {
    await signIn(request, adminAccount);

    const response = await request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      user?: { id?: string; username?: string | null; isAdmin?: boolean };
    };
    expect(typeof body.user?.id).toBe("string");
    expect(typeof body.user?.username).toBe("string");
    expect(body.user?.isAdmin).toBe(true);
  });
});
