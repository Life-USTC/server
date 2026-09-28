import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mergeTests } from "@playwright/test";
import type {
  OAuthClient,
  OAuthConsent,
  Upload,
  User,
} from "@/generated/prisma-node/client";
import {
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { test as storageTest } from "../../../../integration/rest/uploads/_fixture";
import {
  type IsolatedWorker,
  test as workerTest,
} from "../../../utils/isolated-worker";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";

type UploadAudit = {
  db: IsolatedWorker["database"]["owner"];
  user: User;
  client: OAuthClient;
  grant: OAuthConsent;
  cookie: { value: string };
  token: string;
  filename: string;
  contents: string;
  upload: Upload;
  mcp: Client;
};

const base = mergeTests(storageTest, workerTest);
export const test = base.extend<{ uploadAudit: UploadAudit }>({
  uploadAudit: async ({ isolatedWorker, uploadBucket, page }, use) => {
    const db = isolatedWorker.database.owner;
    const mcp = new Client({ name: "upload-audit", version: "1.0.0" });
    try {
      const actor = await isolatedWorker.createActor();
      const marker = `upload-audit-${crypto.randomUUID()}`;
      const scope = restWriteScope("workspace.upload");
      const { user, client } = await db.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: actor.id },
          data: { name: "Private upload owner" },
        });
        const client = await tx.oAuthClient.create({
          data: {
            name: marker,
            clientId: crypto.randomUUID(),
            clientSecret: crypto.randomUUID(),
            redirectUris: [`${isolatedWorker.origin}/oauth-e2e/callback`],
            type: "public",
            tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
            disabled: false,
            scopes: [scope],
            grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
            responseTypes: [OAUTH_CODE_RESPONSE_TYPE],
            requirePKCE: true,
            metadata: { source: "e2e_fixture" },
          },
        });
        return { user, client };
      });
      await page.context().addCookies([actor.cookie]);
      const token = await authorizeDeviceBearer(
        page.request,
        isolatedWorker.origin,
        client.clientId,
        scope,
        "/api/mcp",
      );
      const grant = await db.oAuthConsent.findUniqueOrThrow({
        where: {
          clientId_userId: { clientId: client.clientId, userId: user.id },
        },
      });
      const filename = `${marker}-private.txt`;
      const contents = `${marker} private body`;
      const key = `uploads/${user.id}/${crypto.randomUUID()}`;
      // Prepare known state through the R2 adapter and owner connection. The
      // assertion target remains the real MCP deletion and its transaction.
      await uploadBucket.put(key, contents, {
        httpMetadata: { contentType: "text/plain" },
      });
      const upload = await db.upload.create({
        data: {
          key,
          userId: user.id,
          filename,
          contentType: "text/plain",
          size: Buffer.byteLength(contents),
        },
      });
      await mcp.connect(
        new StreamableHTTPClientTransport(
          new URL(`${isolatedWorker.origin}/api/mcp`),
          { requestInit: { headers: { authorization: `Bearer ${token}` } } },
        ),
      );
      await use({
        db,
        user,
        client,
        grant,
        cookie: actor.cookie,
        token,
        filename,
        contents,
        upload,
        mcp,
      });
    } finally {
      // Close the transport before the enclosing fixture stops its private
      // Worker and removes all DB/R2 state, including incomplete acquisition.
      await mcp.close();
    }
  },
});
