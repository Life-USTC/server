import type { FullConfig } from "@playwright/test";
import "dotenv/config";
import { bootstrapPlaywrightData } from "../../tools/dev/e2e";

export default async function globalSetup(_: FullConfig) {
  await bootstrapPlaywrightData(process.env);
}
