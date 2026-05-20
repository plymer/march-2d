export type Edge = "top" | "right" | "bottom" | "left";
export type SegmentOnCell = [Edge, Edge];

export function applyThreshold(grid: number[][], threshold: number) {
  const yDim = grid.length;
  const xDim = grid[0]?.length;

  const outputGrid: number[][] = [];

  if (xDim === 0 || xDim === undefined || yDim === 0 || yDim === undefined)
    throw new Error(" Grid input is invalid");

  for (let y = 0; y < yDim; y++) {
    outputGrid.push([]);
    for (let x = 0; x < xDim; x++) {
      if (grid[y]?.[x] === undefined) throw new Error("Gridpoint in grid is undefined");
      outputGrid[y]?.push(grid[y]![x]! >= threshold ? 1 : 0);
    }
  }

  return outputGrid;
}

export function marchGrid(inputGrid: number[][]) {
  const inputYDim = inputGrid.length;
  const inputXDim = inputGrid[0]?.length;

  if (inputXDim === 0 || inputXDim === undefined || inputYDim === 0 || inputYDim === undefined)
    throw new Error(" Grid input is invalid");

  const outputYDim = inputYDim - 1;
  const outputXDim = inputXDim - 1;

  const outputGrid: number[][] = [];

  for (let y = 0; y < outputYDim; y++) {
    outputGrid.push([]);
    for (let x = 0; x < outputXDim; x++) {
      // y is the row
      // x is the column
      const topLeft = inputGrid[y]![x];
      const topRight = inputGrid[y]![x + 1];
      const bottomRight = inputGrid[y + 1]![x + 1];
      const bottomLeft = inputGrid[y + 1]![x];

      outputGrid[y]?.push(Number(`0b${topLeft}${topRight}${bottomRight}${bottomLeft}`));
    }
  }

  return { marchedGrid: outputGrid, marchedXDim: outputXDim, marchedYDim: outputYDim };
}

const interpolatePoint = (a: number, b: number, targetValue: number) => {
  if (a === b) return 0.5;
  return (targetValue - a) / (b - a);
};

/**
 * Converts marching squares solved topology into geometry by interpolating a point on the edge that is crossed using the original field data values to find the exact position of the contour line along the edges of the cell
 * @param x the column index of the cell being evaluated
 * @param y the row index of the cell being evaluated
 * @param edge the edge of the cell that is being crossed by the contour line
 * @param grid dataset being contoured, used to look up the original field data values at the corners of the cell for interpolation
 * @param targetValue the threshold value that is being contoured, used as the target value for interpolation to find the exact position of the contour line along the edge of the cell
 * @returns an [x, y] coordinate pair representing the position of the contour line along the edge of the cell, where x and y are in the same units as the input grid (e.g. if the grid is a 10x10 array representing a 10x10 unit area, then x and y will be in units of that area)
 */
export const pointOnEdge = (
  x: number,
  y: number,
  edge: Edge,
  grid: number[][],
  targetValue: number,
): [number, number] => {
  // these points use the incoming grid's values with the two points of data selected via the topology in order to produce the actual geometry of the line segments later on

  // the marched grid was literally only used to compute the topology and is no longer used in this algorithm
  const tl = grid[y]![x]!; // top left corner value
  const tr = grid[y]![x + 1]!; // top right corner value
  const br = grid[y + 1]![x + 1]!; // bottom right corner value
  const bl = grid[y + 1]![x]!; // bottom left corner value

  switch (edge) {
    case "top": {
      const t = interpolatePoint(tl, tr, targetValue);
      return [x + t, y];
    }
    case "right": {
      const t = interpolatePoint(tr, br, targetValue);
      return [x + 1, y + t];
    }
    case "bottom": {
      const t = interpolatePoint(bl, br, targetValue);
      return [x + t, y + 1];
    }
    case "left": {
      const t = interpolatePoint(tl, bl, targetValue);
      return [x, y + t];
    }
  }
};

/**
 * Resolve saddle points in marching squares by looking at the average value of the cell and determining if the center is above or below the threshold, then using that to consistently choose one of the two possible topologies for cases 5 and 10
 * @param x the column index of the cell being evaluated
 * @param y the row index of the cell being evaluated
 * @param cellIndex the binary index of the cell being evaluated (either 0b0101 or 0b1010 for the ambiguous cases)
 * @param grid dataset being contoured, used to look up the original field data values at the corners of the cell for interpolation
 * @param targetValue the threshold value that is being contoured, used as the target value for interpolation to find the exact position of the contour line along the edge of the cell
 * @returns an array of one or two line segments (as pairs of edges) representing the topology of the contour line through the cell, where the choice of topology for the ambiguous cases is determined by whether the center of the cell is above or below the threshold value
 */
export const resolveAmbiguousCase = (
  x: number,
  y: number,
  cellIndex: number,
  grid: number[][],
  targetValue: number,
): SegmentOnCell[] | undefined => {
  if (cellIndex !== 0b0101 && cellIndex !== 0b1010) return undefined;

  const tl = grid[y]![x]!;
  const tr = grid[y]![x + 1]!;
  const br = grid[y + 1]![x + 1]!;
  const bl = grid[y + 1]![x]!;
  const center = (tl + tr + br + bl) / 4;

  // is the center of the cell above or below the threshold? use that to determine which topology to use for the ambiguous cases
  const greaterThanTarget = center >= targetValue;

  if (cellIndex === 0b0101) {
    return greaterThanTarget
      ? [
          ["top", "left"],
          ["bottom", "right"],
        ]
      : [
          ["top", "right"],
          ["left", "bottom"],
        ];
  }

  return greaterThanTarget
    ? [
        ["top", "right"],
        ["left", "bottom"],
      ]
    : [
        ["top", "left"],
        ["bottom", "right"],
      ];
};

export const renderAsciiSegments = (
  segments: [[number, number], [number, number]][],
  gridXDim: number,
  gridYDim: number,
  scale = 6,
) => {
  const canvasWidth = (gridXDim - 1) * scale + 1;
  const canvasHeight = (gridYDim - 1) * scale + 1;

  const canvas: string[][] = Array.from({ length: canvasHeight }, () =>
    Array.from({ length: canvasWidth }, () => " "),
  );

  const plot = (x: number, y: number, ch: string) => {
    const cx = Math.round(x * scale);
    const cy = Math.round(y * scale);
    if (cx < 0 || cx >= canvasWidth || cy < 0 || cy >= canvasHeight) return;
    canvas[cy]![cx] = ch;
  };

  const drawSegment = (a: [number, number], b: [number, number]) => {
    const [x0, y0] = a;
    const [x1, y1] = b;
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * scale * 2),
    );

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      plot(x, y, ".");
    }

    plot(x0, y0, "o");
    plot(x1, y1, "o");
  };

  for (const [p0, p1] of segments) drawSegment(p0, p1);

  const output = canvas.map((row) => row.join("")).join("\n");
  console.log("\nASCII isolines:\n");
  console.log(output);
};
