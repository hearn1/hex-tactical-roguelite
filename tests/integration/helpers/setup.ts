// @vitest-environment happy-dom

// Stub requestAnimationFrame to be a no-op that returns an ID without ever
// scheduling or calling the callback. This prevents CombatThreeRenderer's
// infinite rAF loop from creating pending async operations inside happy-dom.
// Without this stub, happy-dom's happyDOM.abort() hangs forever waiting for
// the rAF loop's whenAsyncComplete() to resolve, blocking vitest teardown.
let _rafId = 0;
globalThis.requestAnimationFrame = (_cb: FrameRequestCallback): number => ++_rafId;
globalThis.cancelAnimationFrame = (_id: number): void => {};

// Patch window.happyDOM.abort to resolve immediately via queueMicrotask instead
// of waiting on happy-dom's AsyncTaskManager, which has a self-defeating timer
// loop in resolveWhenComplete() when running under vitest's vm context:
//   - AsyncTaskManager captures globalThis.setTimeout at module-load time
//   - In the happy-dom vm context, that IS happy-dom's tracked setTimeout
//   - resolveWhenComplete() sets a "native" timer via TIMER.setTimeout, but since
//     TIMER.setTimeout is really window.setTimeout, startTimer() is called, adding
//     the timer to runningTimers — then endTimer fires resolveWhenComplete() again
//     before the resolving callback runs, sees runningTimers.length > 0, and loops
// queueMicrotask is NOT tracked by happy-dom, so it breaks the loop.
{
  const win = globalThis.window as (Window & { happyDOM?: { abort(): Promise<void> } }) | undefined;
  if (win?.happyDOM?.abort) {
    const origAbort = win.happyDOM.abort.bind(win.happyDOM);
    win.happyDOM.abort = (): Promise<void> => {
      origAbort().catch(() => {}); // fire-and-forget: let happy-dom cancel what it can
      return new Promise<void>((resolve) => queueMicrotask(resolve));
    };
  }
}

const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type: string) {
  if (type === "2d") {
    return {
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      setTransform: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      save: () => {},
      restore: () => {},
    } as unknown as CanvasRenderingContext2D;
  }
  return origGetContext.call(this, type);
};
