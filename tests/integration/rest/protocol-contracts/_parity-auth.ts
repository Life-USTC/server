import { expect } from "@playwright/test";
import { symmetricDecrypt } from "better-auth/crypto";
import { importJWK, SignJWT } from "jose";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";

/** Arrange read credentials with the private Worker's actual key and audience. */
export async function createParityTokenSigner(worker: IsolatedWorker) {
  const response = await fetch(`${worker.origin}/api/auth/jwks`);
  const { keys } = (await response.json()) as { keys: { kid: string }[] };
  expect(response.status).toBe(200);
  const key = await worker.database.owner.jwks.findFirstOrThrow({
    where: { id: { in: keys.map((key) => key.kid) } },
    orderBy: { createdAt: "desc" },
  });
  expect(key.alg).toBe("EdDSA");
  const privateJwk = await symmetricDecrypt({
    key: "e2e-dev-secret-not-for-production",
    data: JSON.parse(key.privateKey),
  });
  const signingKey = await importJWK(JSON.parse(privateJwk), "EdDSA");
  return (input: {
    clientId: string;
    grantId: string;
    userId: string;
    scopes: string[];
    resource: string;
    issuedAt: number;
    expiresAt: number;
  }) =>
    new SignJWT({
      azp: input.clientId,
      scope: input.scopes.join(" "),
      [OAUTH_GRANT_ID_CLAIM]: input.grantId,
    })
      .setProtectedHeader({ alg: "EdDSA", kid: key.id, typ: "JWT" })
      .setSubject(input.userId)
      .setAudience(input.resource)
      .setIssuer(`${worker.origin}/api/auth`)
      .setIssuedAt(input.issuedAt)
      .setExpirationTime(input.expiresAt)
      .sign(signingKey);
}
