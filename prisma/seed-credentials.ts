import { hashPassword } from "better-auth/crypto";

type SeedEnv = Record<string, string | undefined>;

function requirePassword(
  env: SeedEnv,
  name: "DEV_ADMIN_PASSWORD" | "DEV_DEBUG_PASSWORD",
) {
  // Match the debug sign-in provider's environment normalization.
  const password = env[name]?.trim();
  if (!password) throw new Error(`${name} is required to seed credentials`);
  return password;
}

/** Supply psql variables without storing hashes in seed.sql or process arguments. */
export async function renderSeedCredentialVariables(env: SeedEnv) {
  const passwords = [
    ["dev_admin_password_hash", requirePassword(env, "DEV_ADMIN_PASSWORD")],
    ["dev_debug_password_hash", requirePassword(env, "DEV_DEBUG_PASSWORD")],
  ] as const;
  const lines: string[] = [];
  for (const [variable, password] of passwords) {
    const hash = await hashPassword(password);
    // Only the generated hex salt/key enters the psql script, never plaintext.
    if (!/^[0-9a-f]+:[0-9a-f]+$/.test(hash)) {
      throw new Error("Unexpected password hash format");
    }
    lines.push(`\\set ${variable} '${hash}'`);
  }
  return `${lines.join("\n")}\n`;
}

if (import.meta.main) {
  try {
    process.stdout.write(await renderSeedCredentialVariables(process.env));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
