export type Edge = "top" | "right" | "bottom" | "left";
export type SegmentOnCell = [Edge, Edge];
export type Point = [number, number];
export type Segment = [Point, Point];
export type FieldTopology = {
  x: number;
  y: number;
  segments: SegmentOnCell[];
};

export type PolylinesWithLevels = {
  polylines: Point[][];
  levelValues: number[]; // unique thresholds, stored once
  polylineLevelIndex: Uint8Array;
};
