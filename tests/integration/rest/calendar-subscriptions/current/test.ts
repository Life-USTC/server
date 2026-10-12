import { expect } from "@playwright/test";
import { test } from "../_fixture";

const base = "/api/workspace/subscriptions/current";

test("anonymous current subscription returns JSON 401", {
  tag: "@Subscription/REST",
}, async ({ run, request }) => {
  await run(async () => {
    const response = await request.get(base);
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

test("known subscriptions expose only the owner's sections and hide feed credentials", {
  tag: "@Subscription/REST",
}, async ({ run, calendarState }) => {
  await run(async () => {
    const { db, owner, other, section, second } = calendarState;
    const secret = crypto.randomUUID();
    await db.user.update({
      where: { id: owner.id },
      data: { calendarFeedToken: secret },
    });
    await db.userSectionSubscription.createMany({
      data: [
        { userId: owner.id, sectionId: section.id },
        { userId: other.id, sectionId: second.id },
      ],
    });
    const response = await owner.request.get(base);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.subscription).toMatchObject({
      userId: owner.id,
      note: expect.any(String),
      calendarPath: null,
      calendarUrl: null,
      sections: [
        expect.objectContaining({ id: section.id, code: section.code }),
      ],
    });
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: owner.id } }))
        .calendarFeedToken,
    ).toBe(secret);
  });
});

test("a new user receives an empty subscription with no feed credential", {
  tag: "@Subscription/REST",
}, async ({ run, createActor }) => {
  await run(async () => {
    const owner = await createActor();
    const response = await owner.request.get(base);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      subscription: {
        userId: owner.id,
        sections: [],
        calendarPath: null,
        calendarUrl: null,
      },
    });
  });
});
