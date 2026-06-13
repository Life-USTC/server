function getCrypto() {
  const crypto = globalThis.crypto;
  if (!crypto) {
    throw new Error("Web Crypto is not available in this runtime");
  }
  return crypto;
}

export function randomBytesBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function randomInt(maxExclusive: number) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive integer");
  }
  if (maxExclusive > 256) {
    throw new RangeError("maxExclusive must be at most 256");
  }

  const limit = Math.floor(256 / maxExclusive) * maxExclusive;
  const bytes = new Uint8Array(1);
  do {
    getCrypto().getRandomValues(bytes);
  } while (bytes[0] >= limit);
  return bytes[0] % maxExclusive;
}

export function randomUUID() {
  return getCrypto().randomUUID();
}

export async function sha256Base64Url(input: string) {
  const bytes = await sha256(input);
  return bytesToBase64Url(bytes);
}

export async function sha256Hex(input: string) {
  const bytes = await sha256(input);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function sha256(input: string) {
  const digest = await getCrypto().subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return new Uint8Array(digest);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
