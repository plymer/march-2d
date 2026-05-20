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

  return outputGrid;
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
