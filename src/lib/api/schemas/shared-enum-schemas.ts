import * as z from "zod";

export const commentVisibilitySchema = z.enum(["public", "logged_in_only"]);

export const commentStatusSchema = z.enum(["active", "softbanned", "deleted"]);

export const homeworkAuditActionSchema = z.enum(["created", "deleted"]);
