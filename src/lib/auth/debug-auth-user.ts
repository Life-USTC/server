import { createLocalAccountIssuer } from "@better-auth/core/db";
import { authPrisma as prisma } from "@/lib/db/auth-prisma";
import { getDebugProviderConfig } from "./debug-auth-config";
import type { DebugProviderId } from "./provider-ids";

/**
 * Debug users are fixture identities, not runtime-provisioned accounts. The
 * auth runtime role can read the rows needed by Better Auth, but it must not
 * be granted write access to privileged User columns just to make a local
 * login work.
 */
export async function ensureDebugCredentialUser(providerId: DebugProviderId) {
  const config = getDebugProviderConfig(providerId);
  const credentialIssuer = createLocalAccountIssuer("credential");

  const user = await prisma.user.findUnique({
    where: { email: config.email },
    select: {
      id: true,
      username: true,
      isAdmin: true,
      profilePictures: true,
    },
  });
  if (!user) {
    throw new Error(
      `Debug auth user ${providerId} (${config.email}) is missing; run the configured database seed before enabling debug auth`,
    );
  }
  if (user.username !== config.username) {
    throw new Error(
      `Debug auth user ${providerId} has unexpected username; run the configured database seed or remove the debug identity override`,
    );
  }
  if (user.isAdmin !== config.isAdmin) {
    throw new Error(
      `Debug auth user ${providerId} has unexpected admin role; run the configured database seed`,
    );
  }
  if (user.profilePictures.length === 0) {
    throw new Error(
      `Debug auth user ${providerId} has no seeded profile pictures; run the configured database seed`,
    );
  }

  const credential = await prisma.account.findUnique({
    where: {
      issuer_providerAccountId: {
        issuer: credentialIssuer,
        providerAccountId: user.id,
      },
    },
    select: {
      password: true,
    },
  });
  if (!credential?.password) {
    throw new Error(
      `Debug auth credential ${providerId} is missing; run the configured database seed before enabling debug auth`,
    );
  }

  return user.id;
}
