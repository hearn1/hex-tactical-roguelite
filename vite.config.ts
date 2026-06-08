import { defineConfig } from "vite";

export default defineConfig({
  // Cache transformed modules between runs so esbuild only re-compiles changed files.
  cacheDir: "node_modules/.vitest",
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Worker threads share the parent process and terminate with it — no orphaned
    // tinypool child processes after non-interactive runs.
    pool: "threads",
    // Cap workers at half the logical CPUs to avoid thrashing on a dev machine.
    maxWorkers: "50%",
    minWorkers: 1,
  },
});
