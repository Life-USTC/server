import { execFile } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { INVENTORY_REPORT_PATH } from "../../scripts/inspect-young-organizers";
import { isolatedDatabaseTest } from "../shared/isolated-database";

const output = INVENTORY_REPORT_PATH;
const temporary = `${output}.tmp`;
const script = fileURLToPath(
  new URL("../../scripts/inspect-young-organizers.ts", import.meta.url),
);
const exec = promisify(execFile);
const reports = [
  "schema_context",
  "row_totals",
  "saved_arrays",
  "raw_shapes",
  "raw_array_elements",
  "identity_ambiguity",
  "provenance_candidates_not_verified",
  "legacy_multi_source_candidate_exposure",
  "notification_aggregates",
];
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Expected a record");
  return value as Record<string, unknown>;
}
async function run(connection: string, args: string[] = []) {
  try {
    const result = await exec("bun", [script, ...args], {
      env: { PATH: process.env.PATH, MIGRATOR_DATABASE_URL: connection },
    });
    return { exit: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const value = record(error);
    if (
      typeof value.code !== "number" ||
      typeof value.stdout !== "string" ||
      typeof value.stderr !== "string"
    )
      throw new Error("Inventory child failed without captured output");
    return { exit: value.code, stdout: value.stdout, stderr: value.stderr };
  }
}
function ownOutput(onTestFinished: (callback: () => Promise<void>) => void) {
  expect(existsSync(output)).toBe(false);
  expect(existsSync(temporary)).toBe(false);
  onTestFinished(async () => {
    await rm(output, { force: true });
    await rm(temporary, { force: true });
  });
}

it("keeps fixed inventory dispatch isolated from migration and rejects unknown operations", {
  tags: ["@Database/Permissions"],
}, async ({ onTestFinished }) => {
  const workflow = record(
    parse(readFileSync(".github/workflows/db-migrate-deploy.yml", "utf8")),
  );
  const triggers = record(workflow.on);
  const choice = record(
    record(record(triggers.workflow_dispatch).inputs).operation,
  );
  expect(choice).toMatchObject({
    type: "choice",
    default: "deploy",
    required: true,
    options: ["deploy", "inspect-young-organizers"],
  });
  expect(record(triggers.push)).toEqual({
    branches: ["main"],
    paths: ["prisma/**"],
  });
  const jobs = record(workflow.jobs);
  const validation = record(jobs.validate);
  const migrate = record(jobs.migrate);
  const inspect = record(jobs.inspect);
  for (const job of [validation, inspect]) {
    expect(job.if).toContain("github.repository == 'Life-USTC/server'");
    expect(job.if).toContain("github.ref == 'refs/heads/main'");
  }
  expect(inspect.if).toContain("github.event_name == 'workflow_dispatch'");
  expect(inspect.if).toContain(
    "needs.validate.outputs.operation == 'inspect-young-organizers'",
  );
  expect(migrate.if).toContain("needs.validate.outputs.operation == 'deploy'");
  expect(inspect.needs).toBe("validate");
  expect(migrate.needs).toBe("validate");
  const inspectSteps = inspect.steps as unknown[];
  expect(inspectSteps.map((step) => record(step).run).filter(Boolean)).toEqual([
    "bun scripts/inspect-young-organizers.ts",
  ]);
  expect(inspectSteps.map((step) => record(step).env).filter(Boolean)).toEqual([
    {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Assert literal GitHub expression syntax.
      MIGRATOR_DATABASE_URL: "${{ secrets.MIGRATOR_DATABASE_URL }}",
    },
  ]);
  expect(JSON.stringify(inspectSteps)).not.toMatch(
    /migrate:deploy|app:prepare|load-static/,
  );
  const steps = validation.steps as unknown[];
  const guard = record(steps[0]);
  expect(record(guard.env).OPERATION).toBe(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Assert literal GitHub expression syntax.
    "${{ github.event_name == 'push' && 'deploy' || inputs.operation }}",
  );
  const directory = mkdtempSync(join(tmpdir(), "young-inventory-operation-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  for (const operation of [
    "deploy",
    "inspect-young-organizers",
    "invalid\noperation=deploy",
  ]) {
    const resultPath = join(directory, crypto.randomUUID());
    let code = 0;
    let stdout = "";
    try {
      const result = await exec("bash", ["-c", String(guard.run)], {
        env: {
          PATH: process.env.PATH,
          OPERATION: operation,
          GITHUB_OUTPUT: resultPath,
        },
      });
      stdout = result.stdout;
    } catch (error) {
      const result = record(error);
      code = typeof result.code === "number" ? result.code : -1;
      stdout = typeof result.stdout === "string" ? result.stdout : "";
    }
    if (operation.startsWith("invalid")) {
      expect(code).toBe(1);
      expect(existsSync(resultPath)).toBe(false);
      expect(stdout).toBe("::error::Unsupported fixed database operation.\n");
    } else {
      expect(code).toBe(0);
      expect(readFileSync(resultPath, "utf8")).toBe(`operation=${operation}\n`);
    }
  }
});

isolatedDatabaseTest(
  "fixed Young inventory reports nine aggregates after a real read-only rollback without exposing data",
  {
    tags: ["@Database/Permissions"],
  },
  async ({ isolatedDatabase: { owner, connections }, onTestFinished }) => {
    ownOutput(onTestFinished);
    const marker = `private-inventory-${crypto.randomUUID()}`;
    const user = await owner.user.create({
      data: { email: `${marker}@example.test`, name: marker },
    });
    const organizer = await owner.youngOrganizer.create({
      data: { name: marker, normalizedName: marker },
    });
    const event = await owner.youngEvent.create({
      data: {
        youngId: marker,
        name: marker,
        organizerId: organizer.id,
        organizer: marker,
        isActive: true,
        upstreamOrganizerIds: ["source-a", "source-b"],
        upstreamSponsorIds: ["host"],
        rawJson: {
          organizer: ["source-a", "source-b"],
          organizer_dictText: [marker, `${marker},comma`],
          sponsor_dictText: marker,
        },
      },
    });
    await owner.userYoungOrganizerSubscription.create({
      data: { userId: user.id, organizerId: organizer.id },
    });
    await owner.userYoungEventSubscription.create({
      data: { userId: user.id, youngId: event.youngId, observedState: marker },
    });
    await owner.youngNotification.create({
      data: {
        userId: user.id,
        youngId: event.youngId,
        organizerId: organizer.id,
        kind: "organizer_digest",
        title: marker,
        body: marker,
        dedupeKey: marker,
      },
    });
    const snapshot = async () => ({
      events: await owner.youngEvent.findMany(),
      organizers: await owner.youngOrganizer.findMany(),
      follows: await owner.userYoungOrganizerSubscription.findMany(),
      subscriptions: await owner.userYoungEventSubscription.findMany(),
      notifications: await owner.youngNotification.findMany(),
    });
    const before = await snapshot();
    const result = await run(connections.owner);
    expect(result.exit).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      operation: "inspect-young-organizers",
      reports: 9,
      rollback: "completed",
    });
    expect(statSync(output).mode & 0o777).toBe(0o600);
    expect(existsSync(temporary)).toBe(false);
    const bytes = readFileSync(output, "utf8");
    const report = record(JSON.parse(bytes));
    expect(report).toMatchObject({
      formatVersion: 1,
      operation: "inspect-young-organizers",
      targetVerification: "configured-migrator-profile-only",
      rollbackCompleted: true,
    });
    const groups = report.reports as Array<{
      name: string;
      rows: Record<string, unknown>[];
    }>;
    expect(groups.map((group) => group.name)).toEqual(reports);
    expect(groups[0].rows[0]).toMatchObject({
      transaction_read_only: "on",
      transaction_isolation: "repeatable read",
      row_security: "off",
      actual_relations_expected_five: "5",
    });
    expect(groups[1].rows).toEqual([
      {
        report: "row_totals",
        events: "1",
        organizer_entities: "1",
        organizer_follows: "1",
        organizer_follow_users: "1",
        direct_event_subscriptions: "1",
        notifications: "1",
      },
    ]);
    expect(groups[7].rows).toEqual([
      {
        report: "legacy_multi_source_candidate_exposure",
        candidate_entities: "1",
        linked_events: "1",
        organizer_follow_rows: "1",
        distinct_follow_users: "1",
        separate_direct_event_subscription_rows: "1",
      },
    ]);
    for (const privateValue of [
      marker,
      user.id,
      organizer.id,
      event.youngId,
      connections.owner,
    ])
      expect(bytes.includes(privateValue)).toBe(false);
    expect(await snapshot()).toEqual(before);
  },
);

isolatedDatabaseTest(
  "restricted inventory failure clears stale output and redacts its real database error",
  {
    tags: ["@Database/Permissions"],
  },
  async ({ isolatedDatabase: { connections }, onTestFinished }) => {
    ownOutput(onTestFinished);
    writeFileSync(output, '{"stale":true}', { mode: 0o600, flag: "wx" });
    const result = await run(connections.app);
    expect(result.exit).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      stage: "inventory",
      code: "42501",
    });
    expect(result.stderr.includes(connections.app)).toBe(false);
    expect(result.stderr.includes("postgresql://")).toBe(false);
    expect(existsSync(output)).toBe(false);
    expect(existsSync(temporary)).toBe(false);
  },
);

it("inventory accepts no SQL/path arguments and never prints malformed connection material", {
  tags: ["@Database/Permissions"],
}, async ({ onTestFinished }) => {
  ownOutput(onTestFinished);
  const malformed = "postgresql://owned-user:owned-redaction-marker@[invalid";
  const argument = await run(malformed, ["--sql", "secret-path.sql"]);
  expect(argument.exit).toBe(1);
  expect(JSON.parse(argument.stderr)).toEqual({
    stage: "configuration",
    code: "UNEXPECTED_ARGUMENT",
  });
  const badProfile = await run(malformed);
  expect(badProfile.exit).toBe(1);
  expect(JSON.parse(badProfile.stderr)).toEqual({
    stage: "configuration",
    code: "EXPLICIT_PROFILE_REQUIRED",
  });
  expect(
    (
      argument.stdout +
      argument.stderr +
      badProfile.stdout +
      badProfile.stderr
    ).includes("owned-redaction-marker"),
  ).toBe(false);
  const controls = await run(
    "\npostgresql://owned-user:owned-redaction-marker@127.0.0.1:1/owned",
  );
  expect(controls.exit).toBe(1);
  expect(JSON.parse(controls.stderr)).toEqual({
    stage: "configuration",
    code: "EXPLICIT_PROFILE_REQUIRED",
  });
  expect(controls.stderr.includes("owned-redaction-marker")).toBe(false);
  expect(existsSync(output)).toBe(false);
});
