import { type APIRequestContext, expect, type Page } from "@playwright/test";

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function uploadFileFromDashboard(
  page: Page,
  options: {
    filename: string;
    mimeType?: string;
    contents: string;
  },
) {
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/uploads") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  const completeResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/uploads/complete") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  const putResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.status() === 200 &&
      response.url().startsWith("http"),
  );

  await page.locator("input#upload-file").setInputFiles({
    name: options.filename,
    mimeType: options.mimeType ?? "text/plain",
    buffer: Buffer.from(options.contents),
  });

  const createResponse = await createResponsePromise;
  const createBody = (await createResponse.json()) as { url?: string };
  expect(createBody.url).toMatch(/^https?:\/\//);

  await putResponsePromise;

  const completeResponse = await completeResponsePromise;
  const completeBody = (await completeResponse.json()) as {
    upload?: { id?: string; filename?: string };
  };
  expect(typeof completeBody.upload?.id).toBe("string");

  const row = await expectUploadRow(page, options.filename);
  return {
    row,
    uploadId: completeBody.upload?.id as string,
  };
}

export async function expectUploadRow(page: Page, filename: string) {
  const row = page
    .locator("tr")
    .filter({
      has: page.getByText(new RegExp(escapeForRegExp(filename), "i")).first(),
    })
    .first();
  await expect(row).toBeVisible({ timeout: 15000 });
  return row;
}

export async function deleteUploadById(page: Page, uploadId: string) {
  const response = await page.request.delete(`/api/uploads/${uploadId}`);
  expect(response.status()).toBe(200);
}

export async function createUploadedFileViaApi(
  request: APIRequestContext,
  options: {
    filename: string;
    mimeType?: string;
    contents: string;
  },
) {
  const uploadSessionResponse = await request.post("/api/uploads", {
    data: {
      filename: options.filename,
      contentType: options.mimeType ?? "text/plain",
      size: Buffer.byteLength(options.contents),
    },
  });
  expect(uploadSessionResponse.status()).toBe(200);
  const uploadSessionBody = (await uploadSessionResponse.json()) as {
    key?: string;
    url?: string;
    maxFileSizeBytes?: number;
  };
  expect(uploadSessionBody.url).toMatch(/^https?:\/\//);
  expect(typeof uploadSessionBody.key).toBe("string");

  const putResponse = await request.put(uploadSessionBody.url as string, {
    data: Buffer.from(options.contents),
    headers: {
      "Content-Type": options.mimeType ?? "text/plain",
    },
  });
  expect(putResponse.status(), await putResponse.text()).toBe(200);

  const completeResponse = await request.post("/api/uploads/complete", {
    data: {
      key: uploadSessionBody.key,
      filename: options.filename,
      contentType: options.mimeType ?? "text/plain",
    },
  });
  expect(completeResponse.status()).toBe(200);
  const completeBody = (await completeResponse.json()) as {
    upload?: { id?: string; key?: string; filename?: string };
  };
  expect(typeof completeBody.upload?.id).toBe("string");

  return {
    key: uploadSessionBody.key as string,
    uploadId: completeBody.upload?.id as string,
    completeResponse,
  };
}
