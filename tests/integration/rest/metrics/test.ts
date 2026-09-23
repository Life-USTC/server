import { expect, test } from "@playwright/test";

const authorization = "Bearer e2e-metrics-secret-not-for-production";

test.describe("GET /metrics", () => {
  test("rejects missing, query-string, cookie and wrong Bearer credentials", async ({
    request,
  }) => {
    const cases: NonNullable<Parameters<typeof request.get>[1]>[] = [
      {},
      { params: { secret: "e2e-metrics-secret-not-for-production" } },
      { headers: { authorization: "Bearer wrong" } },
      {
        headers: {
          cookie:
            "better-auth.session_token=e2e-metrics-secret-not-for-production",
        },
      },
    ];
    for (const options of cases) {
      const response = await request.get("/metrics", options);
      expect(response.status()).toBe(401);
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(await response.text()).toBe("Unauthorized\n");
    }
  });

  test("serves valid text metrics with session cookies ignored", async ({
    request,
  }) => {
    const response = await request.get("/metrics", {
      headers: {
        authorization,
        cookie: "better-auth.session_token=invalid-session",
      },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe(
      "text/plain; version=0.0.4; charset=utf-8",
    );
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
    const body = await response.text();
    expect(body).toContain("# TYPE life_ustc_users gauge\n");
    expect(body).toMatch(/^life_ustc_users \d+$/m);
    expect(body).toContain("life_ustc_metrics_generated_timestamp_seconds");
    expect(body).not.toContain("e2e-metrics-secret");
    expect(body).not.toMatch(/(?:user_id|request_id|client_id|email|day)=/);
    expect(body.endsWith("\n")).toBe(true);
    const second = await request.get("/metrics", {
      headers: { authorization },
    });
    expect(second.status()).toBe(200);
    expect(await second.text()).toContain(
      "# TYPE life_ustc_user_registrations_total counter\n",
    );
    expect(body).toContain(
      "# TYPE life_ustc_feature_operation_duration_seconds histogram\n",
    );
    expect(body).not.toMatch(/^life_ustc_feature_operations\{/m);
  });

  test("does not accept writes", async ({ request }) => {
    expect(
      (await request.post("/metrics", { headers: { authorization } })).status(),
    ).toBe(405);
  });
});
