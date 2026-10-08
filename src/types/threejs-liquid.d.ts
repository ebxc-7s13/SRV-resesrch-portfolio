// Minimal typings for the threejs-components liquid1 ESM build. API surface
// verified against threejs-components@0.0.27
// (build/backgrounds/liquid1.min.js): default factory returning the app
// object with liquidPlane, loadImage/loadEnvMap, setRain and dispose.
declare module "threejs-components/build/backgrounds/liquid1.min.js" {
  export type LiquidPlane = {
    material: {
      metalness: number;
      roughness: number;
      needsUpdate?: boolean;
    };
    uniforms: {
      displacementScale: { value: number };
      [uniform: string]: { value: unknown };
    };
    setImage: (texture: unknown) => void;
  };

  export type LiquidApp = {
    three: {
      maxPixelRatio?: number;
      fpsLimit?: number;
      isDisposed: boolean;
      size: { width: number; height: number; pixelRatio: number };
      resize: () => void;
    };
    liquidPlane: LiquidPlane;
    loadImage: (url: string | null) => Promise<void>;
    loadEnvMap: (url: string | null) => Promise<void>;
    setRain: (enabled: boolean) => void;
    setRainTime: (seconds: number) => void;
    dispose: () => void;
  };

  const createLiquidBackground: (
    canvas: HTMLCanvasElement,
    options?: Record<string, unknown>,
  ) => LiquidApp;
  export default createLiquidBackground;
}
