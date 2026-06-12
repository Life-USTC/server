import type { getAuthEnv } from "@/app-env";
import {
  mapGithubProfileToUser,
  mapGoogleProfileToUser,
} from "@/lib/auth/oauth-profile";

type AuthEnv = ReturnType<typeof getAuthEnv>;

function getProviderCredentials(
  clientId: string | undefined,
  clientSecret: string | undefined,
) {
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function buildBetterAuthSocialProviders(authEnv: AuthEnv) {
  const github = getProviderCredentials(
    authEnv.AUTH_GITHUB_ID,
    authEnv.AUTH_GITHUB_SECRET,
  );
  const google = getProviderCredentials(
    authEnv.AUTH_GOOGLE_ID,
    authEnv.AUTH_GOOGLE_SECRET,
  );

  return {
    ...(github
      ? {
          github: {
            clientId: github.clientId,
            clientSecret: github.clientSecret,
            mapProfileToUser: mapGithubProfileToUser,
          },
        }
      : {}),
    ...(google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            mapProfileToUser: mapGoogleProfileToUser,
          },
        }
      : {}),
  };
}
