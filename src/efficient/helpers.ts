import { resolveAmbiguousCase } from "../utils/utils.js";
import type { Edge, Point, SegmentOnCell } from "../utils/types.js";

const thresholdEpsilon = 1e-9;

type EdgeCode = 0 | 1 | 2 | 3; // top, right, bottom, left
type EdgeCodeSegment = readonly [EdgeCode, EdgeCode];
type EdgeCodeSegments = readonly EdgeCodeSegment[];

// Dense LUT for the 16 marching-square cases.
const caseToSegmentsDense: ReadonlyArray<SegmentOnCell[] | undefined> = [
  undefined,
  [["left", "bottom"]],
  [["bottom", "right"]],
  [["left", "right"]],
  [["top", "right"]],
  undefined,
  [["top", "bottom"]],
  [["left", "top"]],
  [["top", "left"]],
  [["top", "bottom"]],
  undefined,
  [["top", "right"]],
  [["left", "right"]],
  [["bottom", "right"]],
  [["left", "bottom"]],
  undefined,
] as const;

const caseToEdgeCodesDense: ReadonlyArray<EdgeCodeSegments | undefined> = [
  undefined,
  [[3, 2]],
  [[2, 1]],
  [[3, 1]],
  [[0, 1]],
  undefined,
  [[0, 2]],
  [[3, 0]],
  [[0, 3]],
  [[0, 2]],
  undefined,
  [[0, 1]],
  [[3, 1]],
  [[2, 1]],
  [[3, 2]],
  undefined,
] as const;

const ambiguousCase5Above: EdgeCodeSegments = [
  [0, 3],
  [2, 1],
] as const;

const ambiguousCase5Below: EdgeCodeSegments = [
  [0, 1],
  [3, 2],
] as const;

const ambiguousCase10Above: EdgeCodeSegments = [
  [0, 1],
  [3, 2],
] as const;

const ambiguousCase10Below: EdgeCodeSegments = [
  [0, 3],
  [2, 1],
] as const;

function validateGrid(grid: number[][]) {
  const yDim = grid.length;
  const xDim = grid[0]?.length;

  if (xDim === undefined || xDim === 0 || yDim === 0) {
    throw new Error("Grid input is invalid");
  }

  for (let y = 0; y < yDim; y++) {
    if (grid[y]?.length !== xDim) {
      throw new Error("Grid rows are not rectangular");
    }
  }

  return { xDim, yDim };
}

const isAboveThreshold = (value: number, threshold: number) => value > threshold + thresholdEpsilon;

/**
 * Build a compact case-grid in one pass from scalar data.
 * Output is row-major with dimensions (xDim - 1) * (yDim - 1).
 */
export function buildCaseGrid(grid: number[][], threshold: number) {
  const { xDim, yDim } = validateGrid(grid);
  const cellXDim = xDim - 1;
  const cellYDim = yDim - 1;

  // allocate the case grid as a typed array for efficiency; each cell is a 4-bit index into the marching squares LUT
  // Uint8Array is the smallest available unsigned integer type, so we use that and just ignore the upper 4 bits of each byte
  // we could use something smaller but we would have to manually manage the process so we use this for convenience
  const caseGrid = new Uint8Array(cellXDim * cellYDim);

  for (let y = 0; y < cellYDim; y++) {
    const rowTop = grid[y]!;
    const rowBottom = grid[y + 1]!;

    for (let x = 0; x < cellXDim; x++) {
      const topLeft = isAboveThreshold(rowTop[x]!, threshold) ? 1 : 0;
      const topRight = isAboveThreshold(rowTop[x + 1]!, threshold) ? 1 : 0;
      const bottomRight = isAboveThreshold(rowBottom[x + 1]!, threshold) ? 1 : 0;
      const bottomLeft = isAboveThreshold(rowBottom[x]!, threshold) ? 1 : 0;

      const caseIndex = (topLeft << 3) | (topRight << 2) | (bottomRight << 1) | bottomLeft;
      caseGrid[y * cellXDim + x] = caseIndex; // row-major storage; our cell's index is y times the width (stride) of the grid, plus the current column
    }
  }

  return { caseGrid, cellXDim, cellYDim, xDim, yDim };
}

export function computeTopologyFromCases(
  caseGrid: Uint8Array,
  cellXDim: number,
  cellYDim: number,
  scalarGrid: number[][],
  threshold: number,
) {
  const topology: { x: number; y: number; segments: SegmentOnCell[] }[] = [];

  for (let y = 0; y < cellYDim; y++) {
    for (let x = 0; x < cellXDim; x++) {
      const caseIndex = caseGrid[y * cellXDim + x]!;

      if (caseIndex === 0 || caseIndex === 15) continue;

      let segments = caseToSegmentsDense[caseIndex];

      if (!segments) {
        segments = resolveAmbiguousCase(x, y, caseIndex, scalarGrid, threshold);
      }
      if (!segments) continue;

      topology.push({ x, y, segments });
    }
  }

  return topology;
}

function edgeCodeToId(
  edgeCode: EdgeCode,
  cellX: number,
  cellY: number,
  cellXDim: number,
  xDim: number,
  horizontalEdgeCount: number,
) {
  if (edgeCode === 0) return cellY * cellXDim + cellX;
  if (edgeCode === 2) return (cellY + 1) * cellXDim + cellX;
  if (edgeCode === 3) return horizontalEdgeCount + cellY * xDim + cellX;
  return horizontalEdgeCount + cellY * xDim + (cellX + 1);
}

function segmentsForAmbiguousCell(
  cellX: number,
  cellY: number,
  caseIndex: number,
  scalarGrid: number[][],
  threshold: number,
) {
  const tl = scalarGrid[cellY]![cellX]!;
  const tr = scalarGrid[cellY]![cellX + 1]!;
  const br = scalarGrid[cellY + 1]![cellX + 1]!;
  const bl = scalarGrid[cellY + 1]![cellX]!;
  const center = (tl + tr + br + bl) * 0.25;
  const centerAbove = isAboveThreshold(center, threshold);

  if (caseIndex === 0b0101) {
    return centerAbove ? ambiguousCase5Above : ambiguousCase5Below;
  }

  return centerAbove ? ambiguousCase10Above : ambiguousCase10Below;
}

export function buildEdgeSegmentsFromCases(
  caseGrid: Uint8Array,
  cellXDim: number,
  cellYDim: number,
  scalarGrid: number[][],
  threshold: number,
) {
  const xDim = cellXDim + 1;
  const yDim = cellYDim + 1;

  const horizontalEdgeCount = cellXDim * yDim;
  const verticalEdgeCount = xDim * cellYDim;
  const endpointCount = horizontalEdgeCount + verticalEdgeCount;

  let segmentCount = 0;

  for (let y = 0; y < cellYDim; y++) {
    for (let x = 0; x < cellXDim; x++) {
      const caseIndex = caseGrid[y * cellXDim + x]!;

      if (caseIndex === 0 || caseIndex === 15) continue;

      const segments =
        caseToEdgeCodesDense[caseIndex] ??
        segmentsForAmbiguousCell(x, y, caseIndex, scalarGrid, threshold);

      segmentCount += segments.length;
    }
  }

  const edgeA = new Uint32Array(segmentCount);
  const edgeB = new Uint32Array(segmentCount);
  let writeIdx = 0;

  for (let y = 0; y < cellYDim; y++) {
    for (let x = 0; x < cellXDim; x++) {
      const caseIndex = caseGrid[y * cellXDim + x]!;

      if (caseIndex === 0 || caseIndex === 15) continue;

      const segments =
        caseToEdgeCodesDense[caseIndex] ??
        segmentsForAmbiguousCell(x, y, caseIndex, scalarGrid, threshold);

      for (const [e0, e1] of segments) {
        const idA = edgeCodeToId(e0, x, y, cellXDim, xDim, horizontalEdgeCount);
        const idB = edgeCodeToId(e1, x, y, cellXDim, xDim, horizontalEdgeCount);

        if (idA === idB) continue;

        edgeA[writeIdx] = idA;
        edgeB[writeIdx] = idB;
        writeIdx++;
      }
    }
  }

  if (writeIdx !== segmentCount) {
    // Degenerate segments were skipped; trim arrays to actual size.
    return {
      edgeA: edgeA.slice(0, writeIdx),
      edgeB: edgeB.slice(0, writeIdx),
      segmentCount: writeIdx,
      endpointCount,
      horizontalEdgeCount,
      xDim,
      yDim,
      cellXDim,
    };
  }

  return { edgeA, edgeB, segmentCount, endpointCount, horizontalEdgeCount, xDim, yDim, cellXDim };
}

function interpolateT(a: number, b: number, threshold: number) {
  if (a === b) return 0.5;
  return (threshold - a) / (b - a);
}

function edgeIdToPoint(
  edgeId: number,
  horizontalEdgeCount: number,
  cellXDim: number,
  xDim: number,
  scalarGrid: number[][],
  threshold: number,
) {
  if (edgeId < horizontalEdgeCount) {
    const y = Math.floor(edgeId / cellXDim);
    const x = edgeId - y * cellXDim;
    const a = scalarGrid[y]![x]!;
    const b = scalarGrid[y]![x + 1]!;
    const t = interpolateT(a, b, threshold);
    return [x + t, y] as Point;
  }

  const localId = edgeId - horizontalEdgeCount;
  const y = Math.floor(localId / xDim);
  const x = localId - y * xDim;
  const a = scalarGrid[y]![x]!;
  const b = scalarGrid[y + 1]![x]!;
  const t = interpolateT(a, b, threshold);
  return [x, y + t] as Point;
}

export function walkEdgeSegmentsIntoPolylines(
  edgeA: Uint32Array,
  edgeB: Uint32Array,
  endpointCount: number,
  horizontalEdgeCount: number,
  cellXDim: number,
  xDim: number,
  scalarGrid: number[][],
  threshold: number,
) {
  const segmentCount = edgeA.length;
  const degree = new Uint16Array(endpointCount);

  for (let i = 0; i < segmentCount; i++) {
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    degree[a] = degree[a]! + 1;
    degree[b] = degree[b]! + 1;
  }

  const offsets = new Uint32Array(endpointCount + 1);
  for (let i = 0; i < endpointCount; i++) {
    offsets[i + 1] = offsets[i]! + degree[i]!;
  }

  const incident = new Uint32Array(offsets[endpointCount]!);
  const cursor = new Uint32Array(offsets);

  for (let i = 0; i < segmentCount; i++) {
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    incident[cursor[a]!] = i;
    cursor[a]!++;
    incident[cursor[b]!] = i;
    cursor[b]!++;
  }

  const pointX = new Float64Array(endpointCount);
  const pointY = new Float64Array(endpointCount);
  const pointReady = new Uint8Array(endpointCount);

  const getPoint = (edgeId: number) => {
    if (pointReady[edgeId] === 1) {
      return [pointX[edgeId]!, pointY[edgeId]!] as Point;
    }

    const [x, y] = edgeIdToPoint(
      edgeId,
      horizontalEdgeCount,
      cellXDim,
      xDim,
      scalarGrid,
      threshold,
    );
    pointX[edgeId] = x;
    pointY[edgeId] = y;
    pointReady[edgeId] = 1;
    return [x, y] as Point;
  };

  const visited = new Uint8Array(segmentCount);
  const polylines: Point[][] = [];

  const walkFrom = (startEdgeId: number) => {
    const line: Point[] = [];
    let currentEdgeId = startEdgeId;
    line.push(getPoint(currentEdgeId));

    while (true) {
      const begin = offsets[currentEdgeId]!;
      const end = offsets[currentEdgeId + 1]!;

      let nextSegment = -1;
      for (let i = begin; i < end; i++) {
        const segIdx = incident[i]!;
        if (visited[segIdx] === 0) {
          nextSegment = segIdx;
          break;
        }
      }

      if (nextSegment === -1) break;

      visited[nextSegment] = 1;
      const a = edgeA[nextSegment]!;
      const b = edgeB[nextSegment]!;
      currentEdgeId = a === currentEdgeId ? b : a;
      line.push(getPoint(currentEdgeId));
    }

    if (line.length > 1) polylines.push(line);
  };

  for (let edgeId = 0; edgeId < endpointCount; edgeId++) {
    if (degree[edgeId] === 1) {
      walkFrom(edgeId);
    }
  }

  for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
    if (visited[segIdx] === 1) continue;
    walkFrom(edgeA[segIdx]!);
  }

  return polylines;
}

/**
 * First efficient pass: typed-array case generation + dense LUT topology, then reuse
 * existing segment interpolation and polyline walking while we validate correctness.
 */
export function marchingSquaresEfficient(thresholds: number[], scalarGrid: number[][]) {
  const allPolylines: Point[][] = [];

  for (const threshold of thresholds) {
    const { caseGrid, cellXDim, cellYDim } = buildCaseGrid(scalarGrid, threshold);

    const { edgeA, edgeB, endpointCount, horizontalEdgeCount, xDim } = buildEdgeSegmentsFromCases(
      caseGrid,
      cellXDim,
      cellYDim,
      scalarGrid,
      threshold,
    );

    const polylines = walkEdgeSegmentsIntoPolylines(
      edgeA,
      edgeB,
      endpointCount,
      horizontalEdgeCount,
      cellXDim,
      xDim,
      scalarGrid,
      threshold,
    );

    allPolylines.push(...polylines);
  }

  return allPolylines;
}
