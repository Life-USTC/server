import type { Plugin } from "vite";

const componentSuffix =
  "/node_modules/@scalar/api-reference/dist/components/ApiReference.vue_vue_type_script_setup_true_lang.js";
const referenceRoot =
  /createElementVNode\("main", \{(?=\s*"aria-label": unref\(apiReferenceLocalization\)\.translate\("navigation\.mainContent", \{ name: unref\(workspaceStore\)\.workspace\.activeDocument\?\.info\?\.title \?\? "" \}\),\s*class: "references-rendered",)/g;

/** Scalar is embedded inside the shell's main; retain its named region and Vue ownership. */
export function embedScalarReferenceRoot(source: string, id: string) {
  if (!id.split("?", 1)[0].replaceAll("\\", "/").endsWith(componentSuffix))
    return null;
  if ([...source.matchAll(referenceRoot)].length !== 1)
    throw new Error(
      "Expected exactly one known Scalar reference root; review the embedded renderer after upgrading Scalar",
    );
  return {
    code: source.replace(referenceRoot, 'createElementVNode("section", {'),
    map: null,
  };
}

export function scalarEmbeddedReferencePlugin(): Plugin {
  return {
    name: "scalar-embedded-reference",
    enforce: "pre",
    // Keep the original component visible to this hook during development too.
    config: () => ({ optimizeDeps: { exclude: ["@scalar/api-reference"] } }),
    transform: embedScalarReferenceRoot,
  };
}
