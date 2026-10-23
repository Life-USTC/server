import { hkdfSync } from "node:crypto";
import { SignJWT } from "jose";

/** Independent signer for expired/unsupported native-request fixtures. */
export async function createSignedDemoCookie(input: {
  issuedAt: number;
  fixtureVersion?: string;
  userId?: string;
}) {
  const key = new Uint8Array(
    hkdfSync(
      "sha256",
      "e2e-dev-secret-not-for-production",
      "life-ustc-demo-signing-v1",
      "life-ustc-demo+jwt",
      32,
    ),
  );
  const token = await new SignJWT({
    fixtureVersion: input.fixtureVersion ?? "todos-v1",
    ...(input.userId ? { userId: input.userId } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "life-ustc-demo+jwt" })
    .setIssuer("life-ustc-demo")
    .setAudience("life-ustc-web-demo")
    .setIssuedAt(input.issuedAt)
    .setExpirationTime(input.issuedAt + 900)
    .sign(key);
  return { name: "life-ustc.demo", value: token };
}
