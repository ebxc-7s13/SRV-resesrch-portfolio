import type { LiquidApp } from "threejs-components/build/backgrounds/liquid1.min.js";

/** Avoid reallocating mobile render targets when browser chrome resizes. */
export function configureLiquidViewport(app: LiquidApp, canvas: HTMLCanvasElement, mobile: boolean) {
  canvas.style.touchAction = "pan-y";
  if (!mobile) return;
  const three = app.three;
  three.maxPixelRatio = 1.25;
  three.fpsLimit = 30;
  const resize = three.resize.bind(three);
  three.resize = () => {
    const parent = canvas.parentElement;
    if (three.isDisposed || !parent) return;
    const ratio = Math.min(window.devicePixelRatio || 1, three.maxPixelRatio ?? 1.25);
    if (parent.offsetWidth === three.size.width && parent.offsetHeight === three.size.height && ratio === three.size.pixelRatio) return;
    resize();
  };
  three.resize();
}
