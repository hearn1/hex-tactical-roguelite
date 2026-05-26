import { hexToPixel, HEX_SIZE } from "../core/hex.ts";

const HEX_CORNERS: { x: number; y: number }[] = (() => {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({ x: Math.cos(angle) * HEX_SIZE, y: Math.sin(angle) * HEX_SIZE });
  }
  return corners;
})();

export function renderHexOutline(
  ctx: CanvasRenderingContext2D,
  h: { q: number; r: number },
  color: string,
  lineWidth: number = 1,
): void {
  const center = hexToPixel(h);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const corner = HEX_CORNERS[i];
    const x = center.x + corner.x;
    const y = center.y + corner.y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function fillHex(
  ctx: CanvasRenderingContext2D,
  h: { q: number; r: number },
  color: string,
): void {
  const center = hexToPixel(h);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const corner = HEX_CORNERS[i];
    const x = center.x + corner.x;
    const y = center.y + corner.y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
