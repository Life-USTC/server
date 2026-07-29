import * as z from "zod";

export const BUS_VERSION_KEY_MAX_LENGTH = 120;
export const BUS_VERSION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const busVersionKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(BUS_VERSION_KEY_MAX_LENGTH)
  .regex(BUS_VERSION_KEY_PATTERN);
