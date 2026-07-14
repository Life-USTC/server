import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const contractsDirectory = fileURLToPath(
  new URL("../../docs/contracts/", import.meta.url),
);
const schemaPath = fileURLToPath(
  new URL("../../docs/contracts.schema.json", import.meta.url),
);

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function assembleContracts() {
  const filenames = (await readdir(contractsDirectory))
    .filter((filename) => filename.endsWith(".json"))
    .sort();
  const modules = Object.fromEntries(
    await Promise.all(
      filenames
        .filter((filename) => !filename.startsWith("_"))
        .map(async (filename) => [
          filename.slice(0, -".json".length),
          await readJson(`${contractsDirectory}${filename}`),
        ]),
    ),
  );

  return {
    meta: await readJson(`${contractsDirectory}_meta.json`),
    product: await readJson(`${contractsDirectory}_product.json`),
    ui: await readJson(`${contractsDirectory}_ui.json`),
    modules,
    cases: await readJson(`${contractsDirectory}_cases.json`),
    audit: await readJson(`${contractsDirectory}_audit.json`),
  };
}

describe("modular product contracts", () => {
  it("satisfy docs/contracts.schema.json", async () => {
    const schema = (await readJson(schemaPath)) as AnySchema;
    const contract = await assembleContracts();
    const validate = new Ajv2020({ allErrors: true }).compile(schema);

    if (!validate(contract)) {
      const diagnostics = (validate.errors ?? [])
        .map(
          (error) =>
            `${error.instancePath || "/"}: ${error.message ?? "invalid"}`,
        )
        .join("\n");
      expect.fail(`Contract schema validation failed:\n${diagnostics}`);
    }
  });
});
