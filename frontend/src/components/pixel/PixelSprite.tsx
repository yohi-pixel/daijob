import { useEffect, useRef } from 'react';
import { SPRITE_IDLE, SPRITE_TALK, SPRITE_SCALE, drawSprite } from './spriteFrames';

interface PixelSpriteProps {
  talking: boolean;
  onClick: () => void;
}

/** Canvas 像素精灵：idle/talk 两帧 + bob 上下浮动 */
export function PixelSprite({ talking, onClick }: PixelSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const talkingRef = useRef(talking);
  talkingRef.current = talking;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let start = 0;

    const animate = (t: number) => {
      if (!start) start = t;
      const elapsed = (t - start) / 1000;
      // bob：上下浮动 2px 周期 1.6s
      const offsetY = Math.round(Math.sin(elapsed * (Math.PI * 2 / 1.6)) * 2);
      drawSprite(ctx, talkingRef.current ? SPRITE_TALK : SPRITE_IDLE, offsetY, SPRITE_SCALE);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={16 * SPRITE_SCALE}
      height={24 * SPRITE_SCALE}
      onClick={onClick}
      className="cursor-pointer"
      style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' }}
      title="逮JOB 求职助手"
    />
  );
}
