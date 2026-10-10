import { nodeProtocolTest } from "./node-protocol-fixture";

export const descriptionTest = nodeProtocolTest.extend(
  "descriptionEditor",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime }) =>
    protocolRuntime.run(() =>
      db.$transaction(async (tx) => {
        const marker = crypto.randomUUID();
        const user = await tx.user.create({
          data: {
            name: "Description contract editor",
            email: `${marker}@example.test`,
            isAdmin: true,
          },
        });
        const teacher = await tx.teacher.create({
          data: { jwId: 1, nameCn: `[integration-test] ${marker}` },
        });
        return { user, teacher };
      }),
    ),
);
