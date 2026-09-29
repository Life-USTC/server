import { createHmac } from "node:crypto";
import { getCookies } from "better-auth/cookies";
import { PLAYWRIGHT_BASE_URL } from "./e2e-db/core";
import { withE2ePrisma } from "./e2e-db/prisma";

// Matches the local Worker configuration in wrangler.e2e.jsonc.
const E2E_AUTH_SECRET = "e2e-dev-secret-not-for-production";

export async function createSignedSessionCookie(
  userId: string,
  secret = E2E_AUTH_SECRET,
) {
  const sessionToken = crypto.randomUUID();
  await withE2ePrisma((prisma) =>
    prisma.session.create({
      data: {
        expires: new Date(Date.now() + 60 * 60 * 1_000),
        sessionToken,
        userId,
      },
    }),
  );

  const signature = createHmac("sha256", secret)
    .update(sessionToken)
    .digest("base64");
  const signedValue = encodeURIComponent(`${sessionToken}.${signature}`);

  return {
    name: getCookies({ baseURL: PLAYWRIGHT_BASE_URL }).sessionToken.name,
    url: PLAYWRIGHT_BASE_URL,
    value: signedValue,
  };
}
