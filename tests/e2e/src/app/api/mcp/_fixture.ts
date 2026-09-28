import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { User } from "../../../../../../src/generated/prisma-node/client";
import { test as workerTest } from "../../../../utils/isolated-worker";
import {
  issueAccessToken,
  MCP_CLIENT_SCOPE,
  MCP_CLIENT_SCOPES,
  type OAuthOwner,
} from "./helpers";

type OAuth = OAuthOwner & { user: User };

/** Every authenticated scenario owns the real Worker, database, OAuth state,
 * queues and storage. A consumer requests only its own domain prerequisites. */
export const test = workerTest.extend<{ oauth: OAuth; mcp: Client }>({
  oauth: async ({ isolatedWorker, page }, use, testInfo) => {
    const actor = await isolatedWorker.createActor();
    const owner: OAuthOwner = { worker: isolatedWorker, clientNames: [] };
    try {
      await page.context().addCookies([actor.cookie]);
      const user = await isolatedWorker.database.owner.user.findUniqueOrThrow({
        where: { id: actor.id },
      });
      await use({ ...owner, user });
    } finally {
      await testInfo.attach("oauth-owned-state", {
        body: JSON.stringify({
          database: isolatedWorker.database.name,
          userId: actor.id,
          clientNames: owner.clientNames,
        }),
        contentType: "application/json",
      });
    }
  },
  mcp: async ({ oauth, page, request }, use) => {
    const resource = `${oauth.worker.origin}/api/mcp`;
    const { accessToken } = await issueAccessToken(page, request, {
      owner: oauth,
      scope: MCP_CLIENT_SCOPE,
      clientScopes: MCP_CLIENT_SCOPES,
      resource,
    });
    const client = new Client({
      name: "life-ustc-e2e-client",
      version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    try {
      await client.connect(transport);
      await use(client);
    } finally {
      // close aborts the SDK; isolatedWorker subsequently stops the owned
      // process group before removing DB/storage, including in-flight tasks.
      await transport.close();
    }
  },
});
