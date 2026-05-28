/**
 * Seed debug users for E2E / iOS integration testing.
 *
 * Usage:
 *   bun run tools/dev/seed/seed-debug-users.ts
 *
 * Creates or updates the scenario debug and admin accounts with credential
 * (email+password) authentication, matching what the signIn() server action
 * does when you click "Debug User" or "Admin User" on the sign-in page.
 *
 * Idempotent — safe to re-run.
 */
import { hashPassword } from "better-auth/crypto";
import { createToolPrisma } from "../../shared/tool-prisma";
import { DEV_SEED, getDevDebugCredentialConfig } from "./dev-seed";

const prisma = createToolPrisma();
const { debug, admin } = getDevDebugCredentialConfig();

const USERS = [
  {
    username: debug.username,
    name: debug.name,
    email: debug.email,
    password: debug.password,
    isAdmin: false,
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${DEV_SEED.debugAvatarSeed}`,
  },
  {
    username: admin.username,
    name: admin.name,
    email: admin.email,
    password: admin.password,
    isAdmin: true,
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${DEV_SEED.adminAvatarSeed}`,
  },
];

async function seedUser(cfg: (typeof USERS)[number]) {
  const hashedPassword = await hashPassword(cfg.password);
  const userData = {
    username: cfg.username,
    email: cfg.email,
    emailVerified: true,
    name: cfg.name,
    image: cfg.image,
    isAdmin: cfg.isAdmin,
    profilePictures: [cfg.image],
  };

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: cfg.username }, { email: cfg.email }] },
    select: { id: true },
  });

  let userId: string;

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...userData,
        profilePictures: { set: userData.profilePictures },
      },
    });
    userId = existing.id;
    console.log(`✅ Updated user: ${cfg.username} (${userId})`);
  } else {
    const created = await prisma.user.create({
      data: userData,
      select: { id: true },
    });
    userId = created.id;
    console.log(`✅ Created user: ${cfg.username} (${userId})`);
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "credential",
        providerAccountId: userId,
      },
    },
    update: {
      userId,
      type: "credential",
      provider: "credential",
      password: hashedPassword,
    },
    create: {
      userId,
      type: "credential",
      provider: "credential",
      providerAccountId: userId,
      password: hashedPassword,
    },
  });

  console.log(`   email: ${cfg.email}`);
  console.log(`   isAdmin: ${cfg.isAdmin}`);
}

async function main() {
  await Promise.all(USERS.map(seedUser));
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
