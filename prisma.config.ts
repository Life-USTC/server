import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'psql "$DATABASE_URL" -f prisma/seed.sql',
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
