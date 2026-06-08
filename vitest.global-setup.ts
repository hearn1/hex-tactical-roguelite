/**
 * Vitest global setup — runs once before and after the entire test suite.
 *
 * The watchdog in setup() runs in the MAIN vitest process before any workers
 * start. It fires 30 s after the run begins only if something is still holding
 * the process open — acting purely as a last-resort safety net for:
 *   (a) map-templates / playthrough workers that crash (OOM/pre-existing) and
 *       never send results, leaving the main process waiting indefinitely
 *   (b) any other future environment teardown hang not covered by other fixes
 *
 * Primary defence: setup.ts stubs requestAnimationFrame to a no-op so that
 * CombatThreeRenderer's infinite rAF loop never registers pending async
 * operations inside happy-dom. This means happyDOM.abort() in vitest's own
 * environment teardown returns immediately, workers exit cleanly, and the
 * process terminates naturally without the watchdog firing at all.
 *
 * Secondary defence: cleanup() in mountApp.ts calls window.happyDOM.cancelAsync()
 * after every test as an additional safety measure.
 *
 * process.exitCode is set by vitest before teardown runs (1 on failure,
 * 0 on success), so the correct exit code is preserved.
 */
export default function setup(): void {
  // Watchdog timer: runs in the main vitest process (not in any worker thread),
  // so it fires even if pool.destroy() hangs waiting for happy-dom worker teardown.
  // unref() means it won't prevent a natural clean exit — it only fires when
  // something else is blocking. 30 s is generous; the full suite takes < 2 s.
  const watchdog = setTimeout(() => {
    process.stderr.write("[vitest-watchdog] pool teardown exceeded 30s — forcing exit\n");
    process.exit(process.exitCode ?? 0);
  }, 30_000);
  (watchdog as unknown as { unref(): void }).unref();
}

export function teardown(): void {
  // intentionally empty — the watchdog in setup() handles the hang case
}
