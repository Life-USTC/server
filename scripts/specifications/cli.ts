import { readFile } from "node:fs/promises";
import { readFeatureSpecifications } from "./repository";
import { checkSpecifications } from "./validate";
import { repositoryRoot, resolveRepositoryFile } from "./yaml";

async function main() {
  const [command, ...arguments_] = process.argv.slice(2);
  switch (command) {
    case "check": {
      if (arguments_.length) throw new Error("Usage: bun run specs:check");
      const result = await checkSpecifications(repositoryRoot);
      console.log(
        `Validated ${result.files} YAML documents and ${result.requirements} requirements.`,
      );
      console.log(
        "Schema and business references are valid. Requirement-to-test correspondence is maintained manually; this command does not establish behavioral coverage.",
      );
      return;
    }
    case "list": {
      if (arguments_.length) throw new Error("Usage: bun run specs:list");
      for (const feature of await readFeatureSpecifications()) {
        console.log(
          `${feature.id}\t${feature.name}\t${feature.requirements.length} requirements\t${feature.requirements.filter((requirement) => requirement.acceptance).length} acceptance scenarios\tdocs/features/${feature.id}.yaml`,
        );
      }
      return;
    }
    case "show": {
      const [id] = arguments_;
      if (arguments_.length !== 1 || !id || !/^[a-z0-9][a-z0-9-]*$/.test(id))
        throw new Error("Usage: bun run specs:show <feature-id>");
      const filename = await resolveRepositoryFile(
        repositoryRoot,
        `docs/features/${id}.yaml`,
      );
      process.stdout.write(await readFile(filename, "utf8"));
      return;
    }
    default:
      throw new Error(
        "Usage: bun run specs:check | specs:list | specs:show <feature-id>",
      );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
