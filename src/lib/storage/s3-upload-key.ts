import { randomUUID } from "node:crypto";

export function buildUploadKey(userId: string) {
  const uniqueSuffix = randomUUID();
  return `uploads/${userId}/${Date.now()}-${uniqueSuffix}`;
}
