import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Use worker threads instead of forked child processes (the default).
    // Forked processes don't receive SIGTERM when the parent exits
    // non-interactively, leaving 15+ tinypool workers hanging.
    // Worker threads share the parent process and always die with it,
    // while still running test files in parallel.
    pool: "threads",
  },
});
