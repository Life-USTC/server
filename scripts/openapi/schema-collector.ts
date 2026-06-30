import type { ZodType } from "zod";
import * as requestSchemas from "../../src/lib/api/schemas/request-schemas";
import * as responseSchemas from "../../src/lib/api/schemas/response-schemas";

export function isZodSchema(value: unknown): value is ZodType {
  if (value === null || typeof value !== "object") return false;
  const ctor = value.constructor;
  if (ctor && typeof ctor === "function" && ctor.name.startsWith("Zod")) {
    return true;
  }
  return "_zod" in value && (value as { _zod?: { def?: { type?: string } } })._zod?.def?.type !== undefined;
}

export class SchemaCollector {
  private readonly byName = new Map<string, ZodType>();
  private readonly registered = new Map<string, ZodType>();

  constructor() {
    for (const [name, value] of Object.entries({ ...requestSchemas, ...responseSchemas })) {
      if (isZodSchema(value)) {
        this.byName.set(name, value);
      }
    }
  }

  lookup(name: string): ZodType | undefined {
    return this.byName.get(name);
  }

  register(name: string): ZodType | undefined {
    const schema = this.byName.get(name);
    if (!schema) return undefined;
    this.registered.set(name, schema);
    return schema;
  }

  getRegisteredSchemas(): Record<string, ZodType> {
    return Object.fromEntries(this.registered);
  }
}
