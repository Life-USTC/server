import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Bucket, sendS3 } from "@/lib/storage/s3";

export async function deleteUploadObject(key: string) {
  await sendS3(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: key }));
}
