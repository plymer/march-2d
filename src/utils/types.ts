export type Edge = "top" | "right" | "bottom" | "left";
export type SegmentOnCell = [Edge, Edge];
export type Point = [number, number];
export type Segment = [Point, Point];
export type FieldTopology = {
  x: number;
  y: number;
  segments: SegmentOnCell[];
};

export type Polylines = { coords: Float64Array; lineOffsets: Uint32Array };

export type PolylinesWithLevels = Polylines & {
  levelValues: number[];
  polylineLevelIndex: Uint8Array;
};
