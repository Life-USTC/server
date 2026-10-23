import { expect, it } from "vitest";

const modules = {
  ...import.meta.glob("../../../../src/routes/.well-known/**/+server.ts"),
  ...import.meta.glob(
    "../../../../src/routes/api/**/.well-known/**/+server.ts",
  ),
};
const routes = Object.keys(modules).map((file) =>
  file.replace("../../../../src/routes", "").replace("/+server.ts", ""),
);
const metadataPaths = [
  "/.well-known/apple-app-site-association",
  "/.well-known/oauth-authorization-server/api/auth",
  "/api/auth/.well-known/openid-configuration",
  "/.well-known/openid-configuration/api/auth",
  "/.well-known/oauth-protected-resource/api/mcp",
  "/.well-known/oauth-protected-resource/api/graphql",
];

it("Well-known discovery route inventory contains only canonical paths", () => {
  expect([...routes].sort()).toEqual([...metadataPaths].sort());
});
