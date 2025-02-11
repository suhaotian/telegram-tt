import React, { type FC, useEffect, useRef } from '../../../lib/teact/teact';
import { GradientRenderer } from '../../../util/gradientRenderer';

interface GradientBackgroundProps {
  colors?: string[];
  className?: string;
  style?: string;
  width?: number;
  height?: number;
}

const GradientBackground: FC<GradientBackgroundProps> = ({ colors, className = '', style = '', width = 50, height = 50 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GradientRenderer>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    const renderer = new GradientRenderer();
    renderer.init(canvas, colors);
    rendererRef.current = renderer;

    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
      }
    };
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
      width={width}
      height={height}
      data-colors={JSON.stringify(colors)}
    />
  );
};

export default GradientBackground;
