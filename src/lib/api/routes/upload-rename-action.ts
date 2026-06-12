import { jsonResponse, notFound } from "@/lib/api/helpers";
import { publicUploadPayload } from "@/lib/api/routes/upload-route-helpers";
import { managedUploadSelect } from "./upload-management-select";

export async function renameUploadAction({
  filename,
  id,
  userId,
}: {
  filename: string;
  id: string;
  userId: string;
}) {
  const { prisma } = await import("@/lib/db/prisma");
  const upload = await prisma.upload.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!upload) {
    return notFound();
  }

  const updated = await prisma.upload.update({
    where: { id: upload.id },
    data: { filename },
    select: managedUploadSelect,
  });

  return jsonResponse({
    upload: publicUploadPayload(updated),
  });
}
