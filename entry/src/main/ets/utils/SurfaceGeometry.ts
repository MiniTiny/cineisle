// Physical surface pixels shared by SDK callbacks and the controller. Engines retain their own guards.
export class SurfaceGeometry {
  static readonly maximumDimensionPx: number = 8192;
  static valid(width: number, height: number): boolean {
    return [width, height].every((value: number): boolean => Number.isSafeInteger(value) && value > 0 && value <= SurfaceGeometry.maximumDimensionPx);
  }
}
