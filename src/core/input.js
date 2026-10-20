/* ================= INPUT ================= */
export const keys = {};
export const joy = { on: false, id: null, bx: 0, by: 0, dx: 0, dy: 0 };
export function inputDir() {
  let x = 0,
    y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  if (joy.on) {
    x += joy.dx;
    y += joy.dy;
  }
  const d = Math.hypot(x, y);
  if (d > 1) {
    x /= d;
    y /= d;
  }
  return { x, y };
}
