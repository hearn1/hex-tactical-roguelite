import { defineConfig } from "vitest/config";

export default defineConfig({
  // Cache transformed modules between runs so esbuild only re-compiles changed files.
  cacheDir: "node_modules/.vitest",
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // forks pool: each test file runs in its own child process.
    // When a child process hangs in happy-dom environment teardown (abort() waiting on
    // async tasks), vitest sends SIGKILL after teardownTimeout ms and the child process
    // is immediately destroyed — the parent vitest process can then exit cleanly.
    // This is the reliable path: with pool:"threads", teardownTimeout only takes effect
    // AFTER pool.destroy() resolves, but pool.destroy() itself waits for worker threads
    // to finish teardown — so the timeout is never reached when a thread hangs there.
    pool: "forks",
    // Cap workers at half the logical CPUs to avoid thrashing on a dev machine.
    maxWorkers: "50%",
    // After 3 s of environment teardown (win.happyDOM.abort()), the child process is
    // force-killed. Normal teardown completes in well under 100 ms.
    teardownTimeout: 3000,
    // Safety-net watchdog in the main vitest process — fires only if the entire run
    // (including pool teardown) exceeds 30 s. With forks+teardownTimeout the watchdog
    // should never fire; it exists solely as a last resort.
    globalSetup: ["./vitest.global-setup.ts"],
  },
});
