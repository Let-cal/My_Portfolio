import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    // Two projects so .ts tests run in node and .tsx component tests in jsdom.
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "components",
          include: ["tests/unit/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
        },
      },
    ],
  },
});
