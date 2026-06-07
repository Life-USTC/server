import { randomUUID } from "node:crypto";
import {
  type DeleteObjectCommand,
  type DeleteObjectCommandOutput,
  type GetObjectCommand,
  type HeadObjectCommand,
  type HeadObjectCommandOutput,
  type PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageEnv } from "@/env";
import { recordStorageOperationMetric } from "@/lib/metrics/observability-metrics";

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getS3Config() {
  const env = getStorageEnv();
  return {
    bucket: env.S3_BUCKET,
    region: env.AWS_REGION ?? "us-east-1",
    endpoint: env.AWS_ENDPOINT_URL_S3,
  };
}

export function getS3Bucket() {
  return requireEnv(getS3Config().bucket, "S3_BUCKET");
}

export function getS3Region() {
  return getS3Config().region;
}

export function getS3Endpoint() {
  return getS3Config().endpoint;
}

function toOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

function getAwsS3ConnectSources(bucket: string, region: string) {
  return [
    `https://${bucket}.s3.${region}.amazonaws.com`,
    `https://s3.${region}.amazonaws.com`,
  ];
}

export function getS3ConnectSources() {
  const { bucket, region, endpoint } = getS3Config();
  const endpointOrigin = toOrigin(endpoint);
  if (endpointOrigin) {
    return [endpointOrigin];
  }

  if (!bucket) {
    return [];
  }

  return getAwsS3ConnectSources(bucket, region);
}

function createS3Client() {
  const { region, endpoint } = getS3Config();
  return new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
}

let s3Client: S3Client | null = null;

function getS3Client() {
  s3Client ??= createS3Client();
  return s3Client;
}

export function sendS3(
  command: HeadObjectCommand,
): Promise<HeadObjectCommandOutput>;
export function sendS3(
  command: DeleteObjectCommand,
): Promise<DeleteObjectCommandOutput>;
export async function sendS3(command: unknown) {
  const operation = getStorageOperationName(command);
  const start = Date.now();
  try {
    const result = await getS3Client().send(command as never);
    recordStorageOperationMetric({
      operation,
      status: "success",
      durationMs: Date.now() - start,
    });
    return result;
  } catch (error) {
    recordStorageOperationMetric({
      operation,
      status: "error",
      durationMs: Date.now() - start,
    });
    throw error;
  }
}

export function getS3SignedUrl(
  command: PutObjectCommand | GetObjectCommand,
  options: { expiresIn: number },
): Promise<string>;
export async function getS3SignedUrl(
  command: unknown,
  options: { expiresIn: number },
) {
  const operation = `${getStorageOperationName(command)}SignedUrl`;
  const start = Date.now();
  try {
    const result = await getSignedUrl(getS3Client(), command as never, {
      expiresIn: options.expiresIn,
    });
    recordStorageOperationMetric({
      operation,
      status: "success",
      durationMs: Date.now() - start,
    });
    return result;
  } catch (error) {
    recordStorageOperationMetric({
      operation,
      status: "error",
      durationMs: Date.now() - start,
    });
    throw error;
  }
}

export function buildUploadKey(userId: string) {
  const uniqueSuffix = randomUUID();
  return `uploads/${userId}/${Date.now()}-${uniqueSuffix}`;
}

function getStorageOperationName(command: unknown) {
  const constructorName =
    command && typeof command === "object"
      ? command.constructor?.name
      : undefined;
  return constructorName?.replace(/Command$/, "") || "unknown";
}
