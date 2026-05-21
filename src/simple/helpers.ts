import type { Point, Segment, SegmentOnCell } from "../utils/types.js";
import { otherEnd, pointKey, pointOnEdge, resolveAmbiguousCase } from "../utils/utils.js";

const caseToSegments: Partial<Record<number, SegmentOnCell[]>> = {
  0b0001: [["left", "bottom"]],
  0b0010: [["bottom", "right"]],
  0b0011: [["left", "right"]],
  0b0100: [["top", "right"]],
  0b0110: [["top", "bottom"]],
  0b0111: [["left", "top"]],
  0b1000: [["top", "left"]],
  0b1001: [["top", "bottom"]],
  0b1011: [["top", "right"]],
  0b1100: [["left", "right"]],
  0b1101: [["bottom", "right"]],
  0b1110: [["left", "bottom"]],
};

export function computeTopology(
  marchedGrid: number[][],
  marchedXDim: number,
  marchedYDim: number,
  griddedData: number[][],
  threshold: number,
) {
  const linesOnGrid: { x: number; y: number; segments: SegmentOnCell[] }[] = [];

  for (let y = 0; y < marchedYDim; y++) {
    for (let x = 0; x < marchedXDim; x++) {
      const currentPoint = marchedGrid[y]![x];

      if (currentPoint === undefined || currentPoint === 0b0000 || currentPoint === 0b1111)
        continue; // no line passes through this cell

      let segments = caseToSegments[currentPoint];

      if (!segments) {
        // this specifically handles the saddle points of case 5 and 10
        segments = resolveAmbiguousCase(x, y, currentPoint, griddedData, threshold);
      }
      if (!segments) continue; // if still no segments, skip this cell

      linesOnGrid.push({ x, y, segments });
    }
  }

  return linesOnGrid;
}

export function interpolateFromTopology(
  linesOnGrid: {
    x: number;
    y: number;
    segments: SegmentOnCell[];
  }[],
  griddedData: number[][],
  threshold: number,
) {
  const interpolatedSegments: Segment[] = [];

  for (const cell of linesOnGrid) {
    for (const [e0, e1] of cell.segments) {
      const p0 = pointOnEdge(cell.x, cell.y, e0, griddedData, threshold);
      const p1 = pointOnEdge(cell.x, cell.y, e1, griddedData, threshold);
      const k0 = pointKey(p0);
      const k1 = pointKey(p1);
      if (k0 === k1) continue; // zero-length segment from tie case
      interpolatedSegments.push([p0, p1]);
    }
  }

  return interpolatedSegments;
}

/**
 * loop over each line segment we generated previously and then:
 * 1. create a key for each endpoint using the pointKey function
 * 2. add the segment index to the adjacency map for each endpoint key
 *    each pointKey will have a list of segment indices (derived from the
 *    interpolatedSegments array) that are connected to that point
 *     this builds a LUT that gives us an exact definition of which segments touch other segments
 * @param interpolatedSegments The array of line segments from the marching squares algorithm
 * @returns A Map where each key is a pointKey string representing a point in the grid, and the value is an array of indices corresponding to segments in the interpolatedSegments array that are connected to that point.
 */
export function computeAdjacency(interpolatedSegments: Segment[]) {
  const adjacency = new Map<string, number[]>();

  for (let i = 0; i < interpolatedSegments.length; i++) {
    const [a, b] = interpolatedSegments[i]!;
    const ka = pointKey(a);
    const kb = pointKey(b);

    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);

    adjacency.get(ka)!.push(i);
    if (kb !== ka) adjacency.get(kb)!.push(i);
  }

  return adjacency;
}

// this function uses the adjacency map to walk from a starting point along connected segments until it reaches a dead end (a point with no unused segments attached to it)

export function walkSegmentsIntoPolylines(
  adjacency: Map<string, number[]>,
  interpolatedSegments: Segment[],
) {
  const used = new Set<number>();
  const polylines: Point[][] = [];

  const walkFromStart = (startKey: string) => {
    const line: Point[] = [];
    let currentKey = startKey;

    // seed with current point
    const [sx, sy] = currentKey.split(",").map(Number);

    if (sx === undefined || sy === undefined || isNaN(sx) || isNaN(sy)) {
      console.warn(`Invalid point key: ${currentKey}`);
      return;
    }

    line.push([sx, sy]);

    while (true) {
      const touching = adjacency.get(currentKey) ?? [];
      const nextSegIdx = touching.find((idx) => !used.has(idx));
      if (nextSegIdx === undefined) break;

      used.add(nextSegIdx);

      const seg = interpolatedSegments[nextSegIdx] as Segment;
      const nextPoint = otherEnd(seg, currentKey);
      line.push(nextPoint);
      currentKey = pointKey(nextPoint);
    }

    if (line.length > 1) polylines.push(line);
  };

  for (const [k, segs] of adjacency.entries()) {
    if (segs.length === 1) {
      walkFromStart(k);
    }
  }

  for (let i = 0; i < interpolatedSegments.length; i++) {
    if (used.has(i)) continue; // if we've already used this segment in a previous walk, skip it

    const currentSeg = interpolatedSegments[i];

    if (!currentSeg) {
      console.warn(`Invalid segment at index ${i}`);
      continue;
    }

    const [a] = currentSeg;
    walkFromStart(pointKey(a));
  }
  return polylines;
}
