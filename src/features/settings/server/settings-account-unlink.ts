import { removeSignInMethod } from "@/lib/auth/sign-in-methods";
import { authPrisma } from "@/lib/db/auth-prisma";

export type SettingsAccountUnlinkResult =
  | "last_account"
  | "not_linked"
  | "unlinked";

export async function unlinkSettingsAccount(
  userId: string,
  provider: string,
): Promise<SettingsAccountUnlinkResult> {
  return removeSignInMethod(authPrisma, userId, "provider", provider);
}
