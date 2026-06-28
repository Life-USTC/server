/**
 * E2E tests for PUT /api/uploads/object.
 *
 * ## PUT /api/uploads/object
 * - Query: key (required, must belong to current user)
 * - Body: binary file contents
 * - Headers: Content-Length (required)
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Returns 400 for missing key or expired session
 * - Returns 403 if key does not start with uploads/{userId}/
 * - Returns 413 if content length exceeds max file size
 *
 * ## Edge cases
 * - Unauthenticated PUT → 401
 * - Missing key → 400
 * - Key prefix mismatch → 403
 * - Full flow: POST /api/uploads session → PUT object → POST /api/uploads/complete
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { assertApiContract } from "../../../_shared/api-contract";

test("/api/uploads/object", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/uploads/object" });
});

test("PUT /api/uploads/object 未登录返回 401", async ({ request }) => {
  const response = await request.put(
    "/api/uploads/object?key=uploads/test/key.txt",
    {
      data: Buffer.from("hello"),
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "5",
      },
    },
  );
  expect(response.status()).toBe(401);
});

test("PUT /api/uploads/object 缺少 key 返回 400", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const response = await page.request.put("/api/uploads/object", {
    data: Buffer.from("hello"),
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": "5",
    },
  });
  expect(response.status()).toBe(400);
});

test("PUT /api/uploads/object key 前缀不匹配返回 403", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const response = await page.request.put(
    "/api/uploads/object?key=uploads/other-user/test.txt",
    {
      data: Buffer.from("hello"),
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "5",
      },
    },
  );
  expect(response.status()).toBe(403);
});

test("PUT /api/uploads/object 可上传二进制对象并完成", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsDebugUser(page, "/");

  const filename = `e2e-api-upload-object-${Date.now()}.txt`;
  const contents = "hello upload object endpoint";
  const size = Buffer.byteLength(contents);

  const sessionResponse = await page.request.post("/api/uploads", {
    data: {
      filename,
      contentType: "text/plain",
      size,
    },
  });
  expect(sessionResponse.status()).toBe(200);
  const sessionBody = (await sessionResponse.json()) as {
    key?: string;
    url?: string;
    maxFileSizeBytes?: number;
  };
  expect(typeof sessionBody.key).toBe("string");
  expect(typeof sessionBody.url).toBe("string");
  expect(typeof sessionBody.maxFileSizeBytes).toBe("number");

  const putResponse = await page.request.put(sessionBody.url as string, {
    data: Buffer.from(contents),
    headers: {
      "Content-Type": "text/plain",
      "Content-Length": String(size),
    },
  });
  expect(putResponse.status(), await putResponse.text()).toBe(200);
  const putBody = (await putResponse.json()) as { success?: boolean };
  expect(putBody.success).toBe(true);

  const completeResponse = await page.request.post("/api/uploads/complete", {
    data: {
      key: sessionBody.key,
      filename,
      contentType: "text/plain",
    },
  });
  expect(completeResponse.status()).toBe(200);
  const completeBody = (await completeResponse.json()) as {
    upload?: { id?: string; filename?: string; size?: number };
  };
  expect(typeof completeBody.upload?.id).toBe("string");
  expect(completeBody.upload?.filename).toBe(filename);
  expect(completeBody.upload?.size).toBe(size);

  // Cleanup
  await page.request.delete(`/api/uploads/${completeBody.upload?.id}`);
});
