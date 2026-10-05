import { makeSignature } from "better-auth/crypto";
import { describe } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

const authOrigin = "http://localhost:3000";

describe("Better Auth update-user field security", () => {
  for (const { name, sessionAge } of [
    {
      name: "rejects self-promotion while preserving legitimate profile updates",
      sessionAge: 60_000,
    },
    {
      name: "valid older sessions retain the same profile field and ownership boundaries",
      sessionAge: 1_800_000,
    },
  ]) {
    it(name, { tags: ["@Account/OAuth"] }, async ({
      isolatedDatabase: { owner: db },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const updateUserRequest = (
          cookie: string,
          body: Record<string, unknown>,
        ) =>
          protocolRuntime.request(() =>
            authPostRoute(
              new Request(`${authOrigin}/api/auth/update-user`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  cookie,
                  origin: authOrigin,
                },
                body: JSON.stringify(body),
              }),
            ),
          );
        const marker = crypto.randomUUID();
        const usernameSuffix = marker.slice(0, 8);
        const token = crypto.randomUUID();
        const { user, otherUser } = await db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: `better-auth-update-${marker}@example.test`,
              name: "Original Name",
            },
          });
          const otherUser = await tx.user.create({
            data: {
              email: `better-auth-other-${marker}@example.test`,
              name: "Other User",
            },
          });
          await tx.session.create({
            data: {
              createdAt: new Date(Date.now() - sessionAge),
              expires: new Date(Date.now() + 60 * 60 * 1000),
              sessionToken: token,
              userId: user.id,
            },
          });
          return { user, otherUser };
        });
        expect(user).toMatchObject({
          isAdmin: false,
          name: "Original Name",
          profilePictures: [],
          username: null,
        });
        const readUser = (id: string) =>
          db.user.findUniqueOrThrow({ where: { id } });
        const context = await getBetterAuthInstance().$context;
        const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;

        const anonymousResponse = await updateUserRequest("", {
          id: user.id,
          userId: user.id,
          name: "Anonymous mutation",
        });
        expect(anonymousResponse.status, await anonymousResponse.text()).toBe(
          401,
        );
        await expect(readUser(user.id)).resolves.toEqual(user);
        await expect(readUser(otherUser.id)).resolves.toEqual(otherUser);

        for (const { body, message } of [
          {
            body: { isAdmin: true },
            message: "isAdmin is not allowed to be set",
          },
          {
            body: {
              profilePictures: ["https://attacker.example/avatar.svg"],
            },
            message: "profilePictures is not allowed to be set",
          },
          { body: { username: "id" }, message: "Invalid username" },
          {
            body: { name: "Rejected partial name", isAdmin: true },
            message: "isAdmin is not allowed to be set",
          },
          {
            body: {
              name: "Rejected partial name",
              profilePictures: ["https://attacker.example/avatar.svg"],
            },
            message: "profilePictures is not allowed to be set",
          },
          {
            body: { name: "Rejected partial name", username: "id" },
            message: "Invalid username",
          },
        ]) {
          const response = await updateUserRequest(cookie, body);
          expect(response.status, JSON.stringify(body)).toBe(400);
          await expect(response.json()).resolves.toMatchObject({ message });
          await expect(readUser(user.id)).resolves.toEqual(user);
          await expect(readUser(otherUser.id)).resolves.toEqual(otherUser);
        }

        const updatedName = "Updated Name";
        const updatedUsername = `after-${usernameSuffix}`;
        const profileResponse = await updateUserRequest(cookie, {
          name: updatedName,
          username: updatedUsername,
        });
        expect(profileResponse.status).toBe(200);
        await expect(profileResponse.json()).resolves.toEqual({
          status: true,
        });
        await expect(readUser(user.id)).resolves.toEqual({
          ...user,
          name: updatedName,
          username: updatedUsername,
          updatedAt: expect.any(Date),
        });

        const targetedResponse = await updateUserRequest(cookie, {
          id: otherUser.id,
          userId: otherUser.id,
          name: "Owner only",
        });
        expect(targetedResponse.status).toBe(200);
        await expect(targetedResponse.json()).resolves.toEqual({
          status: true,
        });
        await expect(readUser(user.id)).resolves.toEqual({
          ...user,
          name: "Owner only",
          username: updatedUsername,
          updatedAt: expect.any(Date),
        });
        await expect(readUser(otherUser.id)).resolves.toEqual(otherUser);
      });
    });
  }
});
