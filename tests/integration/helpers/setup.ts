// @vitest-environment happy-dom
const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type: string) {
  if (type === "2d") {
    return {
      clearRect: () => {},
      fillRect: () => {},
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
      save: () => {},
      restore: () => {},
    } as unknown as CanvasRenderingContext2D;
  }
  return origGetContext.call(this, type);
};
