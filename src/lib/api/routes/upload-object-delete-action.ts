import { deleteStorageObject } from "@/lib/storage/r2-object";

export async function deleteUploadObject(key: string) {
  await deleteStorageObject(key);
}
