import { getStorageEnv } from "@/app-env";

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getS3Config() {
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
