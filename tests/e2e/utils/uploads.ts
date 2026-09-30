import { type APIRequestContext, expect } from "@playwright/test";

export async function createUploadedFileViaApi(
  request: APIRequestContext,
  options: {
    filename: string;
    mimeType?: string;
    contents: string;
  },
) {
  const uploadSessionResponse = await request.post("/api/workspace/uploads", {
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

  const completeResponse = await request.post(
    "/api/workspace/uploads/complete",
    {
      data: {
        key: uploadSessionBody.key,
        filename: options.filename,
        contentType: options.mimeType ?? "text/plain",
      },
    },
  );
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
