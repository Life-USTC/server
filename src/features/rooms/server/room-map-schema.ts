import * as z from "zod";

export const roomCodeSchema = z
  .string()
  .trim()
  .max(64)
  .transform((value) => value.normalize("NFKC").toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/));
export const roomMapSchema = z.strictObject({
  code: z.string(),
  building: z.string().nullable(),
  floor: z.string().nullable(),
  status: z.enum(["highlighted", "overview", "unavailable"]),
  imageUrl: z.string().nullable(),
  sourceImageUrl: z.string().nullable(),
});
export type RoomMap = z.infer<typeof roomMapSchema>;
const assetPath = z
  .string()
  .regex(/^imgs\/[A-Za-z0-9_\-/.\u3400-\u9fff]+\.png$/)
  .refine((value) => !value.includes(".."));
export const roomMapManifestSchema = z.object({
  rooms: z.array(
    z.object({
      code: roomCodeSchema,
      building: z.string(),
      floor: z.string(),
      imagePath: assetPath,
      sourceImagePath: assetPath,
    }),
  ),
});
export type RoomMapManifest = z.infer<typeof roomMapManifestSchema>;
