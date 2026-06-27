import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/html" }],
  ],
});
