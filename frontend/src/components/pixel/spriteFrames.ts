/**
 * 像素精灵帧数据 —— 逮JOB 品牌标记（16×24 像素，两帧：idle / talk）
 *
 * 配色已跟随「猎场」方向调整：工装用墨蓝（与 UI 结构色同一支），
 * 头顶一盏信号黄头灯 —— 全站唯一的有色相只出现在这一盏灯和新鲜度标记上。
 */
export const SPRITE_COLORS: Record<string, string | null> = {
  S: '#f0c4a0', // 皮肤
  H: '#16233a', // 头发
  T: '#0e1b2c', // 工装（墨）
  P: '#33455e', // 裤（石板灰蓝）
  B: '#0b1522', // 鞋
  A: '#ffb020', // 头灯（信号黄）
  E: '#0e1b2c', // 眼
  W: '#ffffff', // 说话时的嘴
  _: null,
};

export const SPRITE_IDLE: string[] = [
  '_,_,_,H,H,H,H,_,_,_,_,_,_,_,_,_',
  '_,_,H,H,A,A,H,H,_,_,_,_,_,_,_,_',
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
  '_,_,B,B,_,_,B,B,_,_,_,_,_,_,_,_',
  '_,_,B,B,_,_,B,B,_,_,_,_,_,_,_,_',
];

export const SPRITE_TALK: string[] = [
  '_,_,_,H,H,H,H,_,_,_,_,_,_,_,_,_',
  '_,_,H,H,A,A,H,H,_,_,_,_,_,_,_,_',
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
  '_,_,B,B,_,_,B,B,_,_,_,_,_,_,_,_',
  '_,_,B,B,_,_,B,B,_,_,_,_,_,_,_,_',
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
