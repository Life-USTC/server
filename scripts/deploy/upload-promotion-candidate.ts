import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { candidateSchema } from "./promotion-evidence";
import { uploadedCandidate } from "./version-upload";

const run = promisify(execFile);

function setting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function main() {
  const commit = candidateSchema.shape.commit.parse(
    setting("WORKERS_CI_COMMIT_SHA"),
  );
  const { stdout } = await run("git", ["rev-parse", "HEAD"]);
  if (stdout.trim() !== commit)
    throw new Error("Build commit differs from the checked-out source.");
  const marker = JSON.parse(
    await readFile(".svelte-kit/cloudflare/_app/version.json", "utf8"),
  ) as { version?: unknown };
  if (marker.version !== commit)
    throw new Error("Compiled Worker marker differs from the build commit.");
  const origin = new URL(setting("PROMOTION_ORIGIN"));
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("PROMOTION_ORIGIN must be an HTTPS origin.");
  const token = setting("PROMOTION_TOKEN");
  if (token.length < 32)
    throw new Error("PROMOTION_TOKEN must contain at least 32 characters.");
  const temporary = await mkdtemp(join(tmpdir(), "life-ustc-version-upload-"));
  try {
    const output = join(temporary, "output.ndjson");
    try {
      await run(
        "node_modules/.bin/wrangler",
        ["versions", "upload", "--keep-vars", "--tag", commit],
        {
          env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: output },
          maxBuffer: 4 * 1024 * 1024,
        },
      );
    } catch {
      throw new Error("Cloudflare version upload failed.");
    }
    const candidate = uploadedCandidate(
      await readFile(output, "utf8"),
      commit,
      "life-ustc",
    );
    const response = await fetch(new URL("/candidates", origin), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(candidate),
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
    if (response.status !== 202)
      throw new Error(`Candidate handoff failed with HTTP ${response.status}.`);
    console.log(
      `Uploaded candidate ${candidate.commit} (${candidate.version}). Production promotion is separate.`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Candidate upload failed.",
  );
  process.exitCode = 1;
});
