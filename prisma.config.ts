import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrate: {
    seed: "tsx prisma/seed.ts",
  },
});
