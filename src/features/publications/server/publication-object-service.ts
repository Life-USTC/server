import { AwsClient } from "aws4fetch";
import { getOptionalTrimmedEnv } from "@/app-env";
import { getCloudflareR2PublicationsBucket } from "@/lib/adapters/cloudflare-runtime";
import type {
  PublicationObjectCompleteRequest,
  PublicationObjectPlanRequest,
} from "@/lib/api/schemas/request-publication-ingestion-schemas";
import type { PublicationIngestionServicePrincipal } from "@/lib/auth/service-principal";
import { prisma } from "@/lib/db/prisma";
import {
  publicationObjectKey,
  publicationPrincipalKey,
} from "./publication-ingestion-service";

const PRESIGN_TTL_SECONDS = 15 * 60;

export class PublicationObjectBadRequestError extends Error {
  readonly code = "publication_object_bad_request";
}

export class PublicationObjectStorageUnavailableError extends Error {
  readonly code = "publication_object_storage_unavailable";
}

export class PublicationObjectNotFoundError extends Error {
  readonly code = "publication_object_not_found";
}

type ObjectKind = PublicationObjectPlanRequest["objects"][number]["kind"];

function requiredHeaders(input: {
  contentType: string;
  kind: ObjectKind;
  sha256: string;
}) {
  return {
    "Content-Type": input.contentType,
    "x-amz-meta-kind": input.kind,
    "x-amz-meta-sha256": input.sha256,
  };
}

function requirePublicationBucket() {
  const bucket = getCloudflareR2PublicationsBucket();
  if (!bucket) {
    throw new PublicationObjectStorageUnavailableError(
      "R2_PUBLICATIONS binding is required",
    );
  }
  return bucket;
}

function publicationR2Config() {
  const accountId = getOptionalTrimmedEnv("R2_ACCOUNT_ID");
  const bucketName = getOptionalTrimmedEnv("R2_PUBLICATIONS_BUCKET_NAME");
  const accessKeyId = getOptionalTrimmedEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getOptionalTrimmedEnv("R2_SECRET_ACCESS_KEY");
  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new PublicationObjectStorageUnavailableError(
      "R2 presigning is not configured",
    );
  }
  return { accountId, bucketName, accessKeyId, secretAccessKey };
}

function presignedPut(input: {
  contentType: string;
  kind: ObjectKind;
  r2Key: string;
  sha256: string;
}) {
  const config = publicationR2Config();
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const encodedKey = input.r2Key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${encodedKey}`,
  );
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));
  const headers = requiredHeaders(input);
  return client
    .sign(url, {
      method: "PUT",
      headers,
      aws: { allHeaders: true, signQuery: true },
    })
    .then((request) => ({
      expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1_000),
      headers,
      url: request.url.toString(),
    }));
}

function hexDigest(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function verifyR2Object(input: {
  contentType: string;
  kind: ObjectKind;
  r2Key: string;
  sha256: string;
  size: number;
}) {
  const bucket = requirePublicationBucket();
  const object = await bucket.head(input.r2Key);
  if (!object) return { ok: false as const, reason: "object is missing" };
  if (object.size !== input.size) {
    return {
      ok: false as const,
      reason: "object size does not match manifest",
    };
  }
  if (object.httpMetadata?.contentType !== input.contentType) {
    return {
      ok: false as const,
      reason: "object content type does not match manifest",
    };
  }
  const metadata = object.customMetadata ?? {};
  if (
    (metadata.sha256 ?? metadata["x-amz-meta-sha256"]) !== input.sha256 ||
    (metadata.kind ?? metadata["x-amz-meta-kind"]) !== input.kind
  ) {
    return {
      ok: false as const,
      reason: "object metadata does not match manifest",
    };
  }
  const checksum = object.checksums?.sha256;
  if (checksum) {
    if (hexDigest(checksum) !== input.sha256) {
      return {
        ok: false as const,
        reason: "object checksum does not match manifest",
      };
    }
    return { ok: true as const };
  }
  // R2 ETags and client-supplied metadata are not content hashes. When the
  // provider does not expose a SHA-256 checksum, read the bounded object and
  // hash the actual bytes before accepting it.
  const body = await bucket.get(input.r2Key);
  if (!body) return { ok: false as const, reason: "object is missing" };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await new Response(body.body).arrayBuffer(),
  );
  if (hexDigest(digest) !== input.sha256) {
    return {
      ok: false as const,
      reason: "object content does not match manifest",
    };
  }
  return { ok: true as const };
}

async function findOwnedBatchObject(
  principal: PublicationIngestionServicePrincipal,
  batchId: string,
  kind: ObjectKind,
  sha256: string,
) {
  const principalKey = publicationPrincipalKey(principal);
  const batch = await prisma.ingestionBatch.findUnique({
    where: { principalKey_batchId: { principalKey, batchId } },
    include: {
      objects: { include: { object: true } },
    },
  });
  if (!batch)
    throw new PublicationObjectNotFoundError("Ingestion batch not found");
  const claim = batch.objects.find(
    ({ object }) => object.kind === kind && object.sha256 === sha256,
  );
  if (!claim)
    throw new PublicationObjectNotFoundError("Object is not in this batch");
  if (claim.object.r2Key !== publicationObjectKey(kind, sha256)) {
    throw new PublicationObjectBadRequestError(
      "Stored object key does not match its content address",
    );
  }
  return { batch, claim };
}

export async function planPublicationObjects(input: {
  payload: PublicationObjectPlanRequest;
  principal: PublicationIngestionServicePrincipal;
}) {
  const { payload } = input;
  const seen = new Set<string>();
  const objects = [];
  for (const requested of payload.objects) {
    const lookupKey = `${requested.kind}:${requested.sha256}`;
    if (seen.has(lookupKey)) {
      throw new PublicationObjectBadRequestError(
        `Duplicate object: ${lookupKey}`,
      );
    }
    seen.add(lookupKey);
    const { claim } = await findOwnedBatchObject(
      input.principal,
      payload.batchId,
      requested.kind,
      requested.sha256,
    );
    const object = claim.object;
    const headers = requiredHeaders({
      contentType: claim.expectedContentType,
      kind: object.kind,
      sha256: claim.expectedSha256,
    });
    const verified = await verifyR2Object({
      contentType: claim.expectedContentType,
      kind: object.kind,
      r2Key: object.r2Key,
      sha256: claim.expectedSha256,
      size: claim.expectedSize,
    });
    if (verified.ok) {
      await prisma.publicationObject.update({
        where: { id: object.id },
        data: {
          ...(object.status === "linked" ? {} : { status: "verified" }),
          verifiedAt: new Date(),
          lastError: null,
        },
      });
      objects.push({
        kind: object.kind,
        sha256: object.sha256,
        r2Key: object.r2Key,
        status: "already_present" as const,
        uploadUrl: null,
        expiresAt: null,
        requiredHeaders: headers,
      });
      continue;
    }
    const signed = await presignedPut({
      contentType: claim.expectedContentType,
      kind: object.kind,
      r2Key: object.r2Key,
      sha256: object.sha256,
    });
    await prisma.publicationObject.update({
      where: { id: object.id },
      data: { status: "pending", lastError: null },
    });
    objects.push({
      kind: object.kind,
      sha256: object.sha256,
      r2Key: object.r2Key,
      status: "upload_required" as const,
      uploadUrl: signed.url,
      expiresAt: signed.expiresAt,
      requiredHeaders: signed.headers,
    });
  }
  return { batchId: payload.batchId, objects };
}

export async function completePublicationObject(input: {
  payload: PublicationObjectCompleteRequest;
  principal: PublicationIngestionServicePrincipal;
}) {
  const { payload } = input;
  const { claim } = await findOwnedBatchObject(
    input.principal,
    payload.batchId,
    payload.kind,
    payload.sha256,
  );
  const object = claim.object;
  if (object.status !== "linked") {
    await prisma.publicationObject.update({
      where: { id: object.id },
      data: { status: "uploaded", lastError: null },
    });
  }
  const verified = await verifyR2Object({
    contentType: claim.expectedContentType,
    kind: object.kind,
    r2Key: object.r2Key,
    sha256: claim.expectedSha256,
    size: claim.expectedSize,
  });
  if (!verified.ok) {
    await prisma.publicationObject.update({
      where: { id: object.id },
      data: { status: "failed", lastError: verified.reason },
    });
    throw new PublicationObjectBadRequestError(verified.reason);
  }
  await prisma.publicationObject.update({
    where: { id: object.id },
    data: {
      ...(object.status === "linked" ? {} : { status: "verified" }),
      verifiedAt: new Date(),
      lastError: null,
    },
  });
  if (object.status !== "linked") {
    await prisma.publicationObject.update({
      where: { id: object.id },
      data: { status: "linked", verifiedAt: new Date(), lastError: null },
    });
  }
  return {
    batchId: payload.batchId,
    kind: object.kind,
    sha256: object.sha256,
    status: "linked" as const,
  };
}
