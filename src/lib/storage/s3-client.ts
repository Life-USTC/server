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
import { recordStorageOperationMetric } from "@/lib/metrics/observability-metrics";
import { getS3Config } from "@/lib/storage/s3-config";

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

function getStorageOperationName(command: unknown) {
  const constructorName =
    command && typeof command === "object"
      ? command.constructor?.name
      : undefined;
  return constructorName?.replace(/Command$/, "") || "unknown";
}
