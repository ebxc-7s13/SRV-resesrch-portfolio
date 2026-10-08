// Minimal typings for the vanta Cells UMD build. Option names verified
// against vanta@0.5.24 dist (color1/color2 — NOT color).
declare module "vanta/dist/vanta.cells.min" {
  import type * as THREE from "three";

  export type VantaCellsOptions = {
    el: HTMLElement;
    THREE?: typeof THREE;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color1?: number;
    color2?: number;
    backgroundColor?: number;
    size?: number;
    speed?: number;
  };

  export type VantaEffect = {
    setOptions: (options: Partial<VantaCellsOptions>) => void;
    destroy: () => void;
  };

  const CELLS: (options: VantaCellsOptions) => VantaEffect;
  export default CELLS;
}
