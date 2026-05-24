declare module "d3-contour" {
  export type ContourMultiPolygon = {
    type: "MultiPolygon";
    value: number;
    coordinates: number[][][][];
  };

  export interface ContoursGenerator {
    (values: ArrayLike<number>): ContourMultiPolygon[];
    size(size: readonly [number, number]): this;
    thresholds(values: Iterable<number> | number): this;
  }

  export function contours(): ContoursGenerator;
}
