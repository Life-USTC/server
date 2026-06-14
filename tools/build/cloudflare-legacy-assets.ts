import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const immutableDir = ".svelte-kit/cloudflare/_app/immutable";

const legacyAssets = {
  css: [{ legacy: "assets/0.DrgszVu3.css", currentPattern: /^0\..+\.css$/ }],
  emptyModules: [
    "chunks/B2t2Ha3Q.js",
    "chunks/Bc3eAtTl.js",
    "chunks/BdepRQY4.js",
  ],
  modules: [
    {
      legacy: "entry/start.ijFq15BM.js",
      currentPattern: /^start\..+\.js$/,
      exports: ["load_css", "start"],
    },
    {
      legacy: "entry/app.BPoavD4E.js",
      currentPattern: /^app\..+\.js$/,
      exportAll: true,
    },
    {
      legacy: "nodes/0.CridME-m.js",
      currentPattern: /^0\..+\.js$/,
      exportAll: true,
    },
    {
      legacy: "nodes/36.Bt6w1ImE.js",
      currentPattern: /^36\..+\.js$/,
      exportAll: true,
    },
  ],
} as const;

async function currentFileIn(subdir: string, pattern: RegExp) {
  const dir = join(immutableDir, subdir);
  const files = await readdir(dir);
  const matches = files.filter((file) => pattern.test(file));
  if (matches.length !== 1) {
    throw new Error(
      `Expected one current Cloudflare asset in ${dir} matching ${pattern}, found ${matches.length}`,
    );
  }
  return matches[0];
}

async function writeCompatAsset(relativePath: string, content: string) {
  const target = join(immutableDir, relativePath);
  if (existsSync(target)) return false;

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  return true;
}

function moduleReexportContent(input: {
  currentFile: string;
  exportAll?: boolean;
  exports?: readonly string[];
}) {
  if (input.exportAll) {
    return `export * from "./${input.currentFile}";\n`;
  }
  if (!input.exports?.length) {
    throw new Error("Expected named exports for compatibility module");
  }
  return `export { ${input.exports.join(", ")} } from "./${input.currentFile}";\n`;
}

let written = 0;

for (const asset of legacyAssets.modules) {
  const subdir = dirname(asset.legacy);
  const currentFile = await currentFileIn(subdir, asset.currentPattern);
  const didWrite = await writeCompatAsset(
    asset.legacy,
    moduleReexportContent({
      currentFile,
      exportAll: "exportAll" in asset ? asset.exportAll : undefined,
      exports: "exports" in asset ? asset.exports : undefined,
    }),
  );
  if (didWrite) written += 1;
}

for (const asset of legacyAssets.css) {
  const subdir = dirname(asset.legacy);
  const currentFile = await currentFileIn(subdir, asset.currentPattern);
  const didWrite = await writeCompatAsset(
    asset.legacy,
    `@import url("./${currentFile}");\n`,
  );
  if (didWrite) written += 1;
}

for (const relativePath of legacyAssets.emptyModules) {
  const didWrite = await writeCompatAsset(relativePath, "export {};\n");
  if (didWrite) written += 1;
}

console.info(
  `Cloudflare legacy asset compatibility complete: ${written} file(s) written under ${basename(immutableDir)}`,
);
