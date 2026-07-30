import {
  buildUserUstcIdentitySummary,
  type UserUstcIdentitySummary,
} from "@/features/settings/lib/ustc-identity";
import { withUserDbContext } from "@/lib/db/prisma";

const userUstcIdentitySelect = {
  upstreamUid: true,
  gid: true,
  sno: true,
  firstSeenAt: true,
  lastSyncedAt: true,
} as const;

export async function listUserUstcIdentities(
  userId: string,
): Promise<UserUstcIdentitySummary> {
  const records = await withUserDbContext(userId, (tx) =>
    tx.userUstcIdentity.findMany({
      where: { userId },
      select: userUstcIdentitySelect,
    }),
  );

  return buildUserUstcIdentitySummary(records);
}
