import { useEffect, useRef } from 'react';
import { SPRITE_IDLE, SPRITE_TALK, SPRITE_SCALE, drawSprite } from './spriteFrames';

interface PixelSpriteProps {
  talking?: boolean;
  onClick?: () => void;
  /** 静止（用于顶栏品牌标记，避免持续动效） */
  animate?: boolean;
  scale?: number;
  className?: string;
  title?: string;
}

/** Canvas 像素精灵。animate 时 idle/talk 两帧 + bob 上下浮动。 */
export function PixelSprite({
  talking = false,
  onClick,
  animate = true,
  scale = SPRITE_SCALE,
  className,
  title,
}: PixelSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const talkingRef = useRef(talking);
  talkingRef.current = talking;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!animate) {
      drawSprite(ctx, SPRITE_IDLE, 0, scale);
      return;
    }

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      drawSprite(ctx, SPRITE_IDLE, 0, scale);
      return;
    }

    let raf = 0;
    let start = 0;
    const run = (t: number) => {
      if (!start) start = t;
      const elapsed = (t - start) / 1000;
      // bob：上下浮动 1 像素，周期 1.6s
      const offsetY = Math.round(Math.sin(elapsed * ((Math.PI * 2) / 1.6)));
      drawSprite(ctx, talkingRef.current ? SPRITE_TALK : SPRITE_IDLE, offsetY, scale);
      raf = requestAnimationFrame(run);
    };

    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [animate, scale]);

  return (
    <canvas
      ref={canvasRef}
      width={16 * scale}
      height={24 * scale}
      onClick={onClick}
      className={className}
      style={{ imageRendering: 'pixelated', display: 'block' }}
      title={title}
      aria-hidden={onClick ? undefined : true}
      role={onClick ? 'button' : undefined}
    />
  );
}
