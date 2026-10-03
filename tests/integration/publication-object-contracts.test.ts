import { expect } from "vitest";
import {
  getPublicPublicationById,
  listPublications,
} from "@/features/publications/server/publication-public-read-service";
import { getPublicPublicationObjectRoute } from "@/lib/api/routes/publication-public-routes";
import { publicationTest as it } from "../shared/publication-object-fixture";

it("publications.objects", async ({ publication }) => {
  await publication.run(async () => {
    const { bucket, fixture, responseStatus, plan, upload, objectRow } =
      publication;
    const f = await fixture("objects");
    expect(await objectRow(f)).toMatchObject({
      r2Key: f.key,
      status: "pending",
      verifiedAt: null,
    });
    expect(await bucket.head(f.key)).toBeNull();
    expect(await (await plan(f)).json()).toMatchObject({
      objects: [{ status: "upload_required", r2Key: f.key }],
    });
    const unrelated = await fixture("unrelated");
    expect(await responseStatus(plan(f, unrelated.payload.batchId))).toBe(404);
    expect(
      await responseStatus(upload(f, { batchId: unrelated.payload.batchId })),
    ).toBe(404);
    expect(await responseStatus(plan(f, "missing-batch"))).toBe(404);
    expect(await responseStatus(upload(f, { bytes: f.bytes.slice(1) }))).toBe(
      400,
    );
    expect(
      await responseStatus(
        upload(f, { bytes: new Uint8Array(f.bytes.length).fill(65) }),
      ),
    ).toBe(503);
    expect((await objectRow(f)).status).toBe("pending");
    expect(await bucket.head(f.key)).toBeNull();
    expect(await responseStatus(upload(f))).toBe(200);
    const stored = await bucket.get(f.key);
    expect(stored).toMatchObject({
      size: f.bytes.length,
      httpMetadata: { contentType: f.object.contentType },
      customMetadata: { kind: f.object.kind, sha256: f.object.sha256 },
    });
    if (!stored) throw new Error("Expected stored publication bytes");
    expect(
      new Uint8Array(await new Response(stored.body).arrayBuffer()),
    ).toEqual(f.bytes);
    expect(await objectRow(f)).toMatchObject({
      status: "linked",
      verifiedAt: expect.any(Date),
      lastError: null,
    });
    expect(await (await plan(f)).json()).toMatchObject({
      objects: [{ status: "already_present", uploadUrl: null }],
    });
  });
});

it("publications.required-upload-headers", async ({ publication }) => {
  await publication.run(async () => {
    const { bucket, secret, origin, fixture, responseStatus, plan, upload } =
      publication;
    const f = await fixture("headers");
    expect(await responseStatus(plan(f, f.payload.batchId, {}))).toBe(401);
    const response = await plan(f);
    const value = await response.json();
    expect(value).toEqual({
      batchId: f.payload.batchId,
      objects: [
        {
          kind: f.object.kind,
          sha256: f.object.sha256,
          r2Key: f.key,
          status: "upload_required",
          uploadUrl: `${origin}/api/ingestion/publications/objects/${f.payload.batchId}/${f.object.kind}/${f.object.sha256}`,
          requiredHeaders: { "Content-Type": "text/markdown" },
        },
      ],
    });
    expect(JSON.stringify(value)).not.toContain(secret);
    for (const type of ["", "text/plain", "text/markdown; charset=utf-8"]) {
      expect(
        await responseStatus(upload(f, { headers: { "content-type": type } })),
      ).toBe(400);
      expect(await bucket.head(f.key)).toBeNull();
    }
    expect(
      await responseStatus(
        upload(f, {
          headers: { "X-Publication-Ingestion-Secret": "wrong" },
        }),
      ),
    ).toBe(401);
    expect(
      await responseStatus(
        upload(f, {
          headers: {
            "x-amz-meta-kind": "asset",
            "x-amz-meta-sha256": "0".repeat(64),
            "x-amz-meta-key": "caller-selected-key",
          },
        }),
      ),
    ).toBe(200);
    expect(await bucket.head("caller-selected-key")).toBeNull();
    expect(await bucket.head(f.key)).toMatchObject({
      customMetadata: { kind: f.object.kind, sha256: f.object.sha256 },
    });
  });
});

it("publications.unchanged-objects", async ({ publication }) => {
  await publication.run(async () => {
    const { db, fixture, ingest, responseStatus, plan, upload, objectRow } =
      publication;
    const f = await fixture("unchanged");
    const replay = { ...f.payload, batchId: `${f.payload.batchId}-retry` };
    const result = await ingest(replay);
    expect(result.results[0]).toMatchObject({
      status: "unchanged",
      objectsNeedingUpload: [{ kind: f.object.kind, sha256: f.object.sha256 }],
    });
    expect(await (await plan(f, replay.batchId)).json()).toMatchObject({
      objects: [{ status: "upload_required" }],
    });
    expect(await responseStatus(upload(f, { batchId: replay.batchId }))).toBe(
      200,
    );
    const verified = await ingest({
      ...f.payload,
      batchId: `${f.payload.batchId}-verified`,
    });
    expect(verified.results[0].status).toBe("unchanged");
    expect(verified.results[0]).not.toHaveProperty("objectsNeedingUpload");
    expect(
      await db.publicationRevision.count({
        where: { publicationId: f.publicationId },
      }),
    ).toBe(1);
    expect(
      await db.ingestionBatchObject.count({
        where: { objectId: (await objectRow(f)).id },
      }),
    ).toBe(3);
  });
});

it("publications.content-type", async ({ publication }) => {
  await publication.run(async () => {
    const {
      db,
      fixture,
      ingest,
      responseStatus,
      plan,
      upload,
      read,
      objectRow,
    } = publication;
    const f = await fixture("content-type", "text/plain");
    const item = f.payload.items[0];
    if (item.tombstone) throw new Error("Expected live revision");
    const alias = {
      ...f.payload,
      batchId: `${f.payload.batchId}-alias`,
      items: [
        { ...item, objects: [{ ...f.object, contentType: "text/markdown" }] },
      ],
    };
    expect((await ingest(alias)).results[0].status).toBe("unchanged");
    const initial = await objectRow(f);
    expect(initial).toMatchObject({
      contentType: "text/plain",
      size: f.bytes.length,
      r2Key: f.key,
    });
    expect(await (await plan(f, alias.batchId)).json()).toMatchObject({
      objects: [{ requiredHeaders: { "Content-Type": "text/plain" } }],
    });
    expect(
      await responseStatus(
        upload(f, {
          batchId: alias.batchId,
          headers: { "content-type": "text/markdown" },
        }),
      ),
    ).toBe(400);
    for (const status of ["pending", "linked"] as const) {
      if (status === "linked")
        expect(
          await responseStatus(upload(f, { batchId: alias.batchId })),
        ).toBe(200);
      const conflict = {
        ...alias,
        batchId: `${f.payload.batchId}-size-${status}`,
        items: [
          {
            ...item,
            revisionHash: "b".repeat(64),
            objects: [
              {
                ...f.object,
                size: f.bytes.length + 1,
                contentType: "application/octet-stream",
              },
            ],
          },
        ],
      };
      await expect(ingest(conflict)).rejects.toThrow(
        "Object manifest does not match",
      );
      expect(await objectRow(f)).toMatchObject({
        contentType: initial.contentType,
        size: initial.size,
        r2Key: initial.r2Key,
      });
    }
    const publicRead = await read(f);
    expect(publicRead.headers.get("content-type")).toBe("text/plain");
    expect(await publicRead.text()).toBe(new TextDecoder().decode(f.bytes));
    expect(
      await db.publicationRevision.count({
        where: { publicationId: f.publicationId },
      }),
    ).toBe(1);
  });
});

it("publications.public-object-read", async ({ publication }) => {
  await publication.run(async () => {
    const { db, bucket, fixture, responseStatus, upload, read, objectRow } =
      publication;
    const f = await fixture("public-read");
    expect(await responseStatus(read(f))).toBe(404);
    expect(await responseStatus(upload(f))).toBe(200);
    expect(await responseStatus(read(f))).toBe(200);
    const object = await objectRow(f);
    const currentPublication = await db.publication.findUniqueOrThrow({
      where: { id: f.publicationId },
    });
    const revisionId = currentPublication.currentRevisionId;
    if (!revisionId) throw new Error("Expected current publication revision");
    for (const change of [
      { status: "pending" as const },
      { status: "failed" as const },
      { r2Key: "noncanonical-key" },
    ]) {
      await db.publicationObject.update({
        where: { id: object.id },
        data: change,
      });
      expect(await responseStatus(read(f, { "If-None-Match": "*" }))).toBe(404);
      await db.publicationObject.update({
        where: { id: object.id },
        data: { status: "linked", r2Key: f.key },
      });
    }
    for (const change of [
      { deletedAt: new Date() },
      { publicationType: "other" as const },
      { currentRevisionId: null },
    ]) {
      await db.publication.update({
        where: { id: f.publicationId },
        data: change,
      });
      expect(await responseStatus(read(f))).toBe(404);
      await db.publication.update({
        where: { id: f.publicationId },
        data: {
          deletedAt: null,
          publicationType: "news",
          currentRevisionId: revisionId,
        },
      });
    }
    for (const change of [
      { isTombstone: true },
      { publicationType: "other" as const },
    ]) {
      await db.publicationRevision.update({
        where: { id: revisionId },
        data: change,
      });
      expect(await responseStatus(read(f))).toBe(404);
      await db.publicationRevision.update({
        where: { id: revisionId },
        data: { isTombstone: false, publicationType: "news" },
      });
    }
    await bucket.delete(f.key);
    expect(await responseStatus(read(f, { "If-None-Match": "*" }))).toBe(404);
    await bucket.put(f.key, "wrong-size", {
      httpMetadata: { contentType: f.object.contentType },
    });
    expect(await responseStatus(read(f))).toBe(404);
    await bucket.put(f.key, f.bytes, {
      httpMetadata: { contentType: "text/html" },
    });
    expect(await responseStatus(read(f))).toBe(404);
  });
});

it("publications.publication-markdown", async ({ publication }) => {
  await publication.run(async () => {
    const {
      db,
      bucket,
      marker,
      fixture,
      ingest,
      runtime,
      responseStatus,
      upload,
      registerImage,
    } = publication;
    const f = await fixture("markdown");
    const detail = () =>
      runtime(() => getPublicPublicationById(f.publicationId));
    expect((await detail())?.revision).toMatchObject({
      bodyMarkdown: null,
      bodyText: "Never use bodyText as Markdown",
    });
    expect(await responseStatus(upload(f))).toBe(200);
    expect((await detail())?.revision.bodyMarkdown).toBe(
      new TextDecoder().decode(f.bytes),
    );
    const listed = await runtime(() =>
      listPublications({ filters: { source: [f.payload.sources[0].id] } }),
    );
    expect(listed.data[0].revision).not.toHaveProperty("bodyText");
    expect(listed.data[0].revision).not.toHaveProperty("bodyMarkdown");
    expect(listed.data[0].revision).not.toHaveProperty("rawMetadata");
    const image = await registerImage(
      f,
      `https://publication.example/${marker}/markdown.png`,
    );
    expect((await detail())?.revision.images).toEqual([
      {
        id: image.hash,
        url: `/api/publications/images/${image.hash}`,
        altText: "Alt",
        title: "Title",
        caption: "Caption",
      },
    ]);
    await bucket.delete(f.key);
    expect((await detail())?.revision.bodyMarkdown).toBeNull();
    await bucket.put(f.key, "Wrong size", {
      httpMetadata: { contentType: f.object.contentType },
    });
    expect((await detail())?.revision.bodyMarkdown).toBeNull();
    await bucket.put(f.key, f.bytes, {
      httpMetadata: { contentType: "text/html" },
    });
    expect((await detail())?.revision.bodyMarkdown).toBeNull();
    const item = f.payload.items[0];
    if (item.tombstone) throw new Error("Expected live revision");
    await ingest({
      ...f.payload,
      batchId: `${f.payload.batchId}-html`,
      items: [
        {
          ...item,
          revisionHash: "c".repeat(64),
          observedAt: "2026-09-03",
          objects: [
            { ...f.object, kind: "body_html", contentType: "text/html" },
          ],
        },
      ],
    });
    const html = await db.publicationObject.findUniqueOrThrow({
      where: { kind_sha256: { kind: "body_html", sha256: f.object.sha256 } },
    });
    await bucket.put(html.r2Key, "<h1>Archived only</h1>");
    await db.publicationObject.update({
      where: { id: html.id },
      data: { status: "linked" },
    });
    expect((await detail())?.revision.bodyMarkdown).toBeNull();
    expect(
      await db.publicationObject.findUnique({ where: { id: html.id } }),
    ).not.toBeNull();
  });
});

it("publications.publication-images", async ({ publication }) => {
  await publication.run(async () => {
    const {
      db,
      bucket,
      marker,
      fixture,
      ingest,
      responseStatus,
      registerImage,
      imageRead,
    } = publication;
    const f = await fixture("image-registry");
    const url = `https://cdn.example/${marker}/image.png?Width=200`;
    const image = await registerImage(f, url);
    expect(
      await db.publicationImageSource.findUnique({ where: { id: image.hash } }),
    ).toMatchObject({ url });
    await bucket.put(image.key, new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: "image/png" },
    });
    expect(await responseStatus(imageRead(image.hash))).toBe(200);
    const wrongHash = Buffer.from(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(url.toLowerCase()),
      ),
    ).toString("hex");
    expect(await responseStatus(imageRead(wrongHash))).toBe(404);
    const item = f.payload.items[0];
    if (item.tombstone) throw new Error("Expected live revision");
    await expect(
      ingest({
        ...f.payload,
        batchId: `${f.payload.batchId}-bad-hash`,
        items: [
          {
            ...item,
            revisionHash: "c".repeat(64),
            observedAt: "2026-09-03",
            imageSources: { [wrongHash]: url },
          },
        ],
      }),
    ).rejects.toThrow("Image source key does not match");
    expect(
      await db.publicationImageSource.findUnique({ where: { id: wrongHash } }),
    ).toBeNull();
    await ingest({
      ...f.payload,
      batchId: `${f.payload.batchId}-new-current`,
      items: [
        { ...item, revisionHash: "d".repeat(64), observedAt: "2026-09-04" },
      ],
    });
    expect(
      await responseStatus(imageRead(image.hash, { "If-None-Match": "*" })),
    ).toBe(404);
    expect(await bucket.head(image.key)).not.toBeNull();
  });
});

it("publications.object-cache-revalidation", async ({ publication }) => {
  await publication.run(async () => {
    const { db, fixture, responseStatus, upload, read } = publication;
    const f = await fixture("cache-revalidation");
    expect(await responseStatus(upload(f))).toBe(200);
    const first = await read(f);
    expect(first.status).toBe(200);
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    if (!etag) throw new Error("Missing object ETag");
    expect(await first.text()).toBe(new TextDecoder().decode(f.bytes));
    expect(first.headers.get("cache-control")).toBe(
      "public, no-cache, no-transform",
    );
    expect(first.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    const unchanged = await read(f, { "If-None-Match": etag });
    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe("");
    expect(unchanged.headers.get("etag")).toBe(etag);
    expect(unchanged.headers.get("cache-control")).toBe(
      first.headers.get("cache-control"),
    );
    expect(unchanged.headers.get("cloudflare-cdn-cache-control")).toBe(
      "no-store",
    );
    await db.publication.update({
      where: { id: f.publicationId },
      data: { deletedAt: new Date() },
    });
    const revoked = await read(f, { "If-None-Match": etag });
    expect(revoked.status).toBe(404);
    expect(revoked.headers.get("cache-control")).toBe("private, no-store");
    expect(await revoked.text()).not.toContain(
      new TextDecoder().decode(f.bytes),
    );
  });
});

it("publications.object-content-disposition", async ({ publication }) => {
  await publication.run(async () => {
    const { db, bucket, origin, fixture, runtime, objectRow } = publication;
    for (const [kind, contentType, disposition] of [
      ["media", "image/png", "inline"],
      ["media", "audio/mpeg", "inline"],
      ["media", "video/mp4", "inline"],
      ["media", "text/html", "attachment"],
      ["body_html", "text/html", "attachment"],
      ["body_markdown", "text/markdown", "attachment"],
      ["raw_page", "text/html", "attachment"],
      ["asset", "application/pdf", "attachment"],
    ] as const) {
      const f = await fixture(
        `disposition-${kind}-${contentType.replace("/", "-")}`,
      );
      const original = await objectRow(f);
      const key = `publications/${kind}/sha256/${f.object.sha256.slice(0, 2)}/${f.object.sha256}`;
      await bucket.put(key, f.bytes, {
        httpMetadata: { contentType },
      });
      await db.publicationObject.update({
        where: { id: original.id },
        data: {
          kind,
          r2Key: key,
          contentType,
          status: "verified",
          verifiedAt: new Date(),
        },
      });
      await db.publicationObjectLink.updateMany({
        where: { objectId: original.id },
        data: { role: kind, filename: '../../unsafe"\r\nX-Injected: yes.pdf' },
      });
      const response = await runtime(() =>
        getPublicPublicationObjectRoute(
          new Request(
            `${origin}/api/publications/objects/${kind}/${f.object.sha256}`,
          ),
          { kind, sha256: f.object.sha256 },
        ),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(contentType);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-injected")).toBeNull();
      const filename = `publication-${kind}-${f.object.sha256.slice(0, 16)}${contentType === "application/pdf" ? ".pdf" : ""}`;
      expect(response.headers.get("content-disposition")).toBe(
        disposition === "inline"
          ? "inline"
          : `attachment; filename="${filename}"`,
      );
      expect(await response.text()).toBe(new TextDecoder().decode(f.bytes));
    }
  });
});
