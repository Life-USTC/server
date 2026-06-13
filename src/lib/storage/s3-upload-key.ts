import { randomUUID } from "@/lib/crypto/web-crypto";

export function buildUploadKey(userId: string) {
  const uniqueSuffix = randomUUID();
  return `uploads/${userId}/${Date.now()}-${uniqueSuffix}`;
}
