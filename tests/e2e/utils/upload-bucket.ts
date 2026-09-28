import { type APIRequestContext, expect } from "@playwright/test";

export type UploadBucket = {
  put(
    key: string,
    contents: string,
    options: { httpMetadata: { contentType: string } },
  ): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array<ArrayBuffer> } | null>;
  head(
    key: string,
  ): Promise<{ size: number; httpMetadata: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }>;
};

/** Observe the real R2 binding through an explicitly supplied Worker request. */
export function createUploadBucket(request: APIRequestContext): UploadBucket {
  const path = "/__test/storage/uploads";
  return {
    async put(key, contents, options) {
      const response = await request.put(path, {
        params: { key },
        data: Buffer.from(contents),
        headers: { "content-type": options.httpMetadata.contentType },
      });
      expect(response.status(), await response.text()).toBe(204);
    },
    async get(key) {
      const response = await request.get(path, { params: { key } });
      if (response.status() === 404) return null;
      expect(response.status(), await response.text()).toBe(200);
      return { body: Uint8Array.from(await response.body()) };
    },
    async head(key) {
      const response = await request.get(path, {
        params: { key, metadata: "1" },
      });
      expect(response.status(), await response.text()).toBe(200);
      return response.json();
    },
    async delete(key) {
      const response = await request.delete(path, { params: { key } });
      expect(response.status(), await response.text()).toBe(204);
    },
    async list(options) {
      const response = await request.get(path, { params: options });
      expect(response.status(), await response.text()).toBe(200);
      return response.json();
    },
  };
}
