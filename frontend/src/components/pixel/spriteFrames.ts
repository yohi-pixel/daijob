/**
 * 像素精灵帧数据（移植自 pixel-assistant.js）
 * 16x24 像素图，两帧：idle / talk
 * 颜色：skin=#f5c5a3, hair=#3d2b1f, shirt=#9d3d00, pants=#2d2f2e, eye=#1a1a1a
 */
export const SPRITE_COLORS: Record<string, string | null> = {
  S: '#f5c5a3',
  H: '#3d2b1f',
  T: '#9d3d00',
  P: '#2d2f2e',
  E: '#1a1a1a',
  W: '#ffffff',
  _: null,
};

export const SPRITE_IDLE: string[] = [
  '_,_,_,H,H,H,H,_,_,_,_,_,_,_,_,_',
  '_,_,H,H,H,H,H,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,E,S,E,S,H,_,_,_,_,_,_,_',
  '_,_,H,S,S,S,S,S,H,_,_,_,_,_,_,_',
  '_,_,_,H,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,_,T,T,T,T,T,_,_,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
];

export const SPRITE_TALK: string[] = [
  '_,_,_,H,H,H,H,_,_,_,_,_,_,_,_,_',
  '_,_,H,H,H,H,H,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,E,S,E,S,H,_,_,_,_,_,_,_',
  '_,_,H,S,S,W,S,S,H,_,_,_,_,_,_,_',
  '_,_,_,H,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,_,T,T,T,T,T,_,_,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
];

export const SPRITE_SCALE = 3;

/** 纯绘制函数（可单测）：frame 为行数组，offsetY 用于上下浮动动画 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  frame: string[],
  offsetY = 0,
  scale = SPRITE_SCALE,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  frame.forEach((row, y) => {
    row.split(',').forEach((cell, x) => {
      const color = SPRITE_COLORS[cell.trim()];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, (y + offsetY) * scale, scale, scale);
    });
  });
}
