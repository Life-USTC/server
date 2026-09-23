import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/db/auth-prisma";

export type SettingsAccountUnlinkResult =
  | "last_account"
  | "not_linked"
  | "unlinked";

export async function unlinkSettingsAccount(
  userId: string,
  provider: string,
): Promise<SettingsAccountUnlinkResult> {
  const [result] = await authPrisma.$queryRaw<{ status: string }[]>(Prisma.sql`
    SELECT public.unlink_settings_account(${userId}, ${provider}) AS status
  `);

  if (
    !result ||
    !["last_account", "not_linked", "unlinked"].includes(result.status)
  ) {
    throw new Error("Unexpected settings account unlink result");
  }
  return result.status as SettingsAccountUnlinkResult;
}
